import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CustomerStatus,
  CustomerType,
  LoyaltyTier,
  CustomerSegmentType,
} from '../entities/customer.entity';

export class CustomerAddressResponseDto {
  @ApiProperty({ description: 'Address identifier' })
  id: string;

  @ApiProperty({ description: 'Address type' })
  type: 'billing' | 'shipping' | 'business';

  @ApiProperty({ description: 'Is this the default address' })
  isDefault: boolean;

  @ApiProperty({ description: 'Address recipient name' })
  name: string;

  @ApiProperty({ description: 'Street address' })
  address: string;

  @ApiProperty({ description: 'City' })
  city: string;

  @ApiProperty({ description: 'State/Province' })
  state: string;

  @ApiProperty({ description: 'Postal code' })
  postalCode: string;

  @ApiProperty({ description: 'Country' })
  country: string;

  @ApiPropertyOptional({ description: 'Phone number for this address' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Additional address notes' })
  notes?: string;
}

export class CustomerPreferencesResponseDto {
  @ApiPropertyOptional({ description: 'Preferred product categories' })
  preferredCategories?: string[];

  @ApiPropertyOptional({ description: 'Preferred brands' })
  preferredBrands?: string[];

  @ApiPropertyOptional({ description: 'Preferred price range' })
  preferredPriceRange?: { min: number; max: number };

  @ApiPropertyOptional({ description: 'Preferred payment methods' })
  preferredPaymentMethods?: string[];

  @ApiPropertyOptional({ description: 'Preferred delivery methods' })
  preferredDeliveryMethods?: string[];

  @ApiPropertyOptional({ description: 'Communication preferences' })
  communicationPreferences?: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    phone: boolean;
  };

  @ApiPropertyOptional({ description: 'Marketing consent' })
  marketingConsent?: boolean;
}

export class CustomerPurchaseBehaviorResponseDto {
  @ApiProperty({ description: 'Average days between orders' })
  averageDaysBetweenOrders: number;

  @ApiPropertyOptional({ description: 'Most active time of day' })
  mostActiveTimeOfDay?: string;

  @ApiPropertyOptional({ description: 'Most active day of week' })
  mostActiveDayOfWeek?: string;

  @ApiPropertyOptional({ description: 'Seasonal purchase patterns' })
  seasonalPurchasePattern?: {
    ramadan: boolean;
    lebaran: boolean;
    christmas: boolean;
    newYear: boolean;
  };

  @ApiPropertyOptional({ description: 'Price sensitivity level' })
  pricesensitivity?: 'low' | 'medium' | 'high';

  @ApiPropertyOptional({ description: 'Brand loyalty level' })
  brandLoyalty?: 'low' | 'medium' | 'high';
}

export class CustomerAnalyticsResponseDto {
  @ApiProperty({ description: 'Customer lifetime value in IDR' })
  lifetimeValue: number;

  @ApiProperty({ description: 'Predicted lifetime value in IDR' })
  predictedLifetimeValue: number;

  @ApiProperty({ description: 'Average order value in IDR' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Total number of orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Total amount spent in IDR' })
  totalSpent: number;

  @ApiProperty({ description: 'Average order frequency (orders per month)' })
  averageOrderFrequency: number;

  @ApiPropertyOptional({ description: 'Date of first order' })
  firstOrderDate?: string;

  @ApiPropertyOptional({ description: 'Date of last order' })
  lastOrderDate?: string;

  @ApiProperty({ description: 'Days since last order' })
  daysSinceLastOrder: number;

  @ApiProperty({ description: 'Churn probability (0-100%)' })
  churnProbability: number;

  @ApiProperty({ description: 'Retention score (0-100)' })
  retentionScore: number;

  @ApiProperty({ description: 'Customer lifecycle stage' })
  lifecycleStage: 'new' | 'growing' | 'mature' | 'declining' | 'dormant';

  @ApiProperty({ description: 'Days since first order' })
  daysSinceFirstOrder: number;

  @ApiProperty({ description: 'Recent order frequency' })
  recentOrderFrequency: number;
}

export class CustomerSupportResponseDto {
  @ApiProperty({ description: 'Number of support tickets' })
  supportTicketsCount: number;

  @ApiProperty({ description: 'Average satisfaction rating (0-10)' })
  averageSatisfactionRating: number;

  @ApiProperty({ description: 'Number of complaints' })
  complaintsCount: number;

  @ApiProperty({ description: 'Number of returns' })
  returnsCount: number;

  @ApiProperty({ description: 'Total value of returns in IDR' })
  totalReturnsValue: number;
}

export class CustomerLoyaltyResponseDto {
  @ApiProperty({ description: 'Current loyalty points' })
  loyaltyPoints: number;

  @ApiProperty({ description: 'Number of referrals made' })
  referralsCount: number;

  @ApiProperty({ description: 'Total value generated from referrals in IDR' })
  referralValue: number;

  @ApiPropertyOptional({ description: 'Customer ID of referrer' })
  referredBy?: string;
}

export class CustomerCommunicationHistoryDto {
  @ApiProperty({ description: 'Communication record ID' })
  id: string;

  @ApiProperty({ description: 'Communication type' })
  type: 'email' | 'sms' | 'whatsapp' | 'phone' | 'push';

  @ApiProperty({ description: 'Communication subject' })
  subject: string;

  @ApiProperty({ description: 'Date sent' })
  sentAt: string;

  @ApiPropertyOptional({ description: 'Date opened' })
  openedAt?: string;

  @ApiPropertyOptional({ description: 'Date clicked' })
  clickedAt?: string;

  @ApiPropertyOptional({ description: 'Date responded' })
  respondedAt?: string;

  @ApiProperty({ description: 'Communication status' })
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'responded' | 'failed';
}

export class CustomerResponseDto {
  @ApiProperty({ description: 'Customer unique identifier' })
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'Auto-generated customer number' })
  customerNumber: string;

  @ApiProperty({ description: 'Customer full name' })
  fullName: string;

  @ApiPropertyOptional({ description: 'Customer first name' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Customer last name' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Customer email address' })
  email?: string;

  @ApiPropertyOptional({ description: 'Customer phone number' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Customer date of birth' })
  dateOfBirth?: string;

  @ApiProperty({ description: 'Customer type', enum: CustomerType })
  customerType: CustomerType;

  @ApiProperty({ description: 'Customer status', enum: CustomerStatus })
  status: CustomerStatus;

  @ApiPropertyOptional({ description: 'Company name (for business customers)' })
  companyName?: string;

  @ApiPropertyOptional({ description: 'Tax ID/NPWP (for business customers)' })
  taxId?: string;

  @ApiPropertyOptional({ description: 'Industry sector' })
  industry?: string;

  @ApiPropertyOptional({ description: 'Business size' })
  businessSize?: string;

  @ApiPropertyOptional({ description: 'Customer addresses' })
  addresses?: CustomerAddressResponseDto[];

  @ApiProperty({ description: 'Customer segment', enum: CustomerSegmentType })
  segment: CustomerSegmentType;

  @ApiProperty({ description: 'Loyalty tier', enum: LoyaltyTier })
  loyaltyTier: LoyaltyTier;

  @ApiPropertyOptional({ description: 'Customer preferences' })
  preferences?: CustomerPreferencesResponseDto;

  @ApiPropertyOptional({ description: 'Purchase behavior data' })
  purchaseBehavior?: CustomerPurchaseBehaviorResponseDto;

  @ApiPropertyOptional({ description: 'Social media profiles' })
  socialProfiles?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    telegram?: string;
  };

  @ApiPropertyOptional({ description: 'External system IDs' })
  externalIds?: {
    shopeeCustomerId?: string;
    tokopediaCustomerId?: string;
    lazadaCustomerId?: string;
    whatsappContactId?: string;
    mokaCustomerId?: string;
  };

  @ApiPropertyOptional({ description: 'Risk assessment data' })
  riskAssessment?: {
    creditScore: number;
    isHighRisk: boolean;
    riskFactors?: {
      paymentDelays: number;
      disputedOrders: number;
      fraudulentActivity: boolean;
      excessiveReturns: boolean;
      notes?: string;
    };
  };

  @ApiPropertyOptional({ description: 'Customer tags' })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Public notes about customer' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Assigned sales representative ID' })
  assignedSalesRepId?: string;

  @ApiPropertyOptional({ description: 'Account manager ID' })
  accountManagerId?: string;

  @ApiProperty({ description: 'Email verification status' })
  isEmailVerified: boolean;

  @ApiProperty({ description: 'Phone verification status' })
  isPhoneVerified: boolean;

  @ApiPropertyOptional({ description: 'Last login timestamp' })
  lastLoginAt?: string;

  @ApiPropertyOptional({ description: 'Email verification timestamp' })
  emailVerifiedAt?: string;

  @ApiPropertyOptional({ description: 'Phone verification timestamp' })
  phoneVerifiedAt?: string;

  @ApiProperty({ description: 'Full address (computed)' })
  fullAddress: string;

  @ApiProperty({ description: 'Is customer active (computed)' })
  isActive: boolean;

  @ApiProperty({ description: 'Is high-value customer (computed)' })
  isHighValue: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: string;

  @ApiPropertyOptional({ description: 'Customer analytics (optional)' })
  analytics?: CustomerAnalyticsResponseDto;

  @ApiPropertyOptional({ description: 'Customer support data (optional)' })
  support?: CustomerSupportResponseDto;

  @ApiPropertyOptional({ description: 'Customer loyalty data (optional)' })
  loyalty?: CustomerLoyaltyResponseDto;

  @ApiPropertyOptional({
    description: 'Recent communication history (optional)',
    type: [CustomerCommunicationHistoryDto],
  })
  communicationHistory?: CustomerCommunicationHistoryDto[];
}

export class CustomerListResponseDto {
  @ApiProperty({
    description: 'Array of customers',
    type: [CustomerResponseDto],
  })
  data: CustomerResponseDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  @ApiProperty({ description: 'Summary statistics' })
  summary: {
    totalCustomers: number;
    activeCustomers: number;
    highValueCustomers: number;
    atRiskCustomers: number;
    averageLifetimeValue: number;
    averageOrderValue: number;
    averageRetentionScore: number;
    topSegments: Array<{
      segment: CustomerSegmentType;
      count: number;
      percentage: number;
    }>;
    topLoyaltyTiers: Array<{
      tier: LoyaltyTier;
      count: number;
      percentage: number;
    }>;
  };
}

export class CustomerDetailResponseDto extends CustomerResponseDto {
  @ApiProperty({ description: 'Customer analytics data' })
  analytics: CustomerAnalyticsResponseDto;

  @ApiProperty({ description: 'Customer support data' })
  support: CustomerSupportResponseDto;

  @ApiProperty({ description: 'Customer loyalty data' })
  loyalty: CustomerLoyaltyResponseDto;

  @ApiPropertyOptional({
    description: 'Communication history',
    type: [CustomerCommunicationHistoryDto],
  })
  communicationHistory?: CustomerCommunicationHistoryDto[];

  @ApiPropertyOptional({ description: 'Marketing campaigns participated' })
  marketingCampaigns?: Array<{
    campaignId: string;
    campaignName: string;
    participatedAt: string;
    response?: 'positive' | 'negative' | 'neutral';
    conversionValue?: number;
  }>;

  @ApiPropertyOptional({ description: 'Custom fields' })
  customFields?: Record<string, any>;
}
