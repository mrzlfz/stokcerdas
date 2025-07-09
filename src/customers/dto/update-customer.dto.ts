import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCustomerDto } from './create-customer.dto';

export class CustomerAnalyticsUpdateDto {
  @ApiPropertyOptional({
    description: 'Lifetime value in IDR',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lifetimeValue?: number;

  @ApiPropertyOptional({
    description: 'Predicted lifetime value in IDR',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  predictedLifetimeValue?: number;

  @ApiPropertyOptional({
    description: 'Average order value in IDR',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  averageOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Total number of orders',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalOrders?: number;

  @ApiPropertyOptional({
    description: 'Total amount spent in IDR',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalSpent?: number;

  @ApiPropertyOptional({
    description: 'Average order frequency (orders per month)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  averageOrderFrequency?: number;

  @ApiPropertyOptional({
    description: 'Date of first order',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  firstOrderDate?: string;

  @ApiPropertyOptional({
    description: 'Date of last order',
    example: '2024-12-15T14:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  lastOrderDate?: string;

  @ApiPropertyOptional({
    description: 'Days since last order',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  daysSinceLastOrder?: number;

  @ApiPropertyOptional({
    description: 'Churn probability (0-100%)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  churnProbability?: number;

  @ApiPropertyOptional({
    description: 'Retention score (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  retentionScore?: number;
}

export class CustomerSupportUpdateDto {
  @ApiPropertyOptional({
    description: 'Number of support tickets',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  supportTicketsCount?: number;

  @ApiPropertyOptional({
    description: 'Average satisfaction rating (0-10)',
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  averageSatisfactionRating?: number;

  @ApiPropertyOptional({
    description: 'Number of complaints',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  complaintsCount?: number;

  @ApiPropertyOptional({
    description: 'Number of returns',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  returnsCount?: number;

  @ApiPropertyOptional({
    description: 'Total value of returns in IDR',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalReturnsValue?: number;
}

export class CustomerLoyaltyUpdateDto {
  @ApiPropertyOptional({
    description: 'Current loyalty points',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  loyaltyPoints?: number;

  @ApiPropertyOptional({
    description: 'Number of referrals made',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  referralsCount?: number;

  @ApiPropertyOptional({
    description: 'Total value generated from referrals in IDR',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  referralValue?: number;
}

export class CustomerPurchaseBehaviorUpdateDto {
  @ApiPropertyOptional({
    description: 'Average days between orders',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  averageDaysBetweenOrders?: number;

  @ApiPropertyOptional({
    description: 'Most active time of day',
    example: '14:30',
  })
  @IsOptional()
  mostActiveTimeOfDay?: string;

  @ApiPropertyOptional({
    description: 'Most active day of week',
    example: 'wednesday',
  })
  @IsOptional()
  mostActiveDayOfWeek?: string;

  @ApiPropertyOptional({
    description: 'Seasonal purchase patterns',
    type: 'object',
  })
  @IsOptional()
  seasonalPurchasePattern?: {
    ramadan: boolean;
    lebaran: boolean;
    christmas: boolean;
    newYear: boolean;
  };

  @ApiPropertyOptional({
    description: 'Price sensitivity level',
    enum: ['low', 'medium', 'high'],
  })
  @IsOptional()
  pricesensitivity?: 'low' | 'medium' | 'high';

  @ApiPropertyOptional({
    description: 'Brand loyalty level',
    enum: ['low', 'medium', 'high'],
  })
  @IsOptional()
  brandLoyalty?: 'low' | 'medium' | 'high';
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiPropertyOptional({
    description: 'Customer analytics data',
    type: CustomerAnalyticsUpdateDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerAnalyticsUpdateDto)
  analytics?: CustomerAnalyticsUpdateDto;

  @ApiPropertyOptional({
    description: 'Customer support data',
    type: CustomerSupportUpdateDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerSupportUpdateDto)
  support?: CustomerSupportUpdateDto;

  @ApiPropertyOptional({
    description: 'Customer loyalty data',
    type: CustomerLoyaltyUpdateDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerLoyaltyUpdateDto)
  loyalty?: CustomerLoyaltyUpdateDto;

  @ApiPropertyOptional({
    description: 'Purchase behavior data',
    type: CustomerPurchaseBehaviorUpdateDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerPurchaseBehaviorUpdateDto)
  purchaseBehavior?: CustomerPurchaseBehaviorUpdateDto;

  @ApiPropertyOptional({
    description: 'Last login timestamp',
    example: '2024-12-15T14:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  lastLoginAt?: string;

  @ApiPropertyOptional({
    description: 'Email verification timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  emailVerifiedAt?: string;

  @ApiPropertyOptional({
    description: 'Phone verification timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  phoneVerifiedAt?: string;
}
