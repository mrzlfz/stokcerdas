import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsObject,
  IsArray,
  IsDateString,
  IsUUID,
  Min,
  Max,
  ValidateNested,
  IsEmail,
  IsPhoneNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities and Enums
import {
  ShippingServiceType,
  InsuranceType,
} from '../entities/shipping-label.entity';
import { TrackingStatus } from '../entities/shipping-tracking.entity';
import { UserRole } from '../../users/entities/user.entity';

// Services
import {
  ShippingService,
  ShippingQuoteRequest,
  CreateShippingLabelRequest,
} from '../services/shipping.service';
import { JneShippingService } from '../integrations/jne/services/jne-shipping.service';
import { JntShippingService } from '../integrations/jnt/services/jnt-shipping.service';

// DTOs
export class AddressDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsString()
  address: string;

  @IsString()
  district: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  postalCode: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class PackageInfoDto {
  @IsNumber()
  @Min(1)
  weight: number; // in grams

  @IsNumber()
  @Min(1)
  length: number; // in cm

  @IsNumber()
  @Min(1)
  width: number; // in cm

  @IsNumber()
  @Min(1)
  height: number; // in cm

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsNumber()
  @Min(1)
  pieces: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number; // for insurance
}

export class GetShippingQuotesDto {
  @IsString()
  originPostalCode: string;

  @IsString()
  destinationPostalCode: string;

  @IsString()
  originCity: string;

  @IsString()
  destinationCity: string;

  @IsString()
  originState: string;

  @IsString()
  destinationState: string;

  @ValidateNested()
  @Type(() => PackageInfoDto)
  packageInfo: PackageInfoDto;

  @IsOptional()
  @IsArray()
  @IsEnum(ShippingServiceType, { each: true })
  serviceTypes?: ShippingServiceType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  carrierIds?: string[];

  @IsOptional()
  @IsBoolean()
  includeInsurance?: boolean;

  @IsOptional()
  @IsBoolean()
  isCod?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;
}

export class CreateShippingLabelDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  rateId: string;

  @IsEnum(ShippingServiceType)
  serviceType: ShippingServiceType;

  @ValidateNested()
  @Type(() => AddressDto)
  senderAddress: AddressDto;

  @ValidateNested()
  @Type(() => PackageInfoDto)
  packageInfo: PackageInfoDto;

  @IsOptional()
  @IsEnum(InsuranceType)
  insuranceType?: InsuranceType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuredValue?: number;

  @IsOptional()
  @IsBoolean()
  isCod?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @IsOptional()
  @IsBoolean()
  requiresSignature?: boolean;

  @IsOptional()
  @IsBoolean()
  isFragile?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialInstructions?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTrackingDto {
  @IsString()
  trackingNumber: string;

  @IsString()
  status: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsObject()
  location?: {
    name: string;
    city: string;
    state: string;
  };

  @IsDateString()
  eventTime: string;

  @IsOptional()
  @IsObject()
  additionalData?: any;
}

export class CancelShipmentDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ShippingAnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  carrierIds?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(ShippingServiceType, { each: true })
  serviceTypes?: ShippingServiceType[];

  @IsOptional()
  @IsBoolean()
  includeDetails?: boolean;
}

export class ShippingLabelsQueryDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  carrierId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeTracking?: boolean = false;
}

@ApiTags('Shipping Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('shipping')
export class ShippingController {
  private readonly logger = new Logger(ShippingController.name);

  constructor(
    private readonly shippingService: ShippingService,
    private readonly jneShippingService: JneShippingService,
    private readonly jntShippingService: JntShippingService,
  ) {}

  // ==================== SHIPPING QUOTES ====================

  @Post('quotes')
  @ApiOperation({ summary: 'Get shipping quotes for a package' })
  @ApiResponse({
    status: 200,
    description: 'Shipping quotes retrieved successfully',
  })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getShippingQuotes(
    @CurrentUser() user: any,
    @Body() quotesDto: GetShippingQuotesDto,
  ) {
    try {
      const quotes = await this.shippingService.getShippingQuotes(
        user.tenantId,
        quotesDto,
      );

      return {
        success: true,
        data: quotes,
        count: quotes.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get shipping quotes: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rates/carriers')
  @ApiOperation({ summary: 'Get available carriers and their services' })
  @ApiResponse({ status: 200, description: 'Carriers retrieved successfully' })
  @ApiQuery({ name: 'active', type: 'boolean', required: false })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getCarriers(
    @CurrentUser() user: any,
    @Query('active') active?: boolean,
  ) {
    try {
      // Mock carrier data - in production this would come from database
      const carriers = [
        {
          id: 'JNE',
          name: 'JNE (Jalur Nugraha Ekakurir)',
          logo: '/logos/jne.png',
          services: [
            {
              code: 'REG',
              name: 'Regular Service',
              type: 'regular',
              estimatedDays: '2-3',
            },
            {
              code: 'YES',
              name: 'Yakin Esok Sampai',
              type: 'express',
              estimatedDays: '1',
            },
            {
              code: 'OKE',
              name: 'Ongkos Kirim Ekonomis',
              type: 'economy',
              estimatedDays: '3-5',
            },
          ],
          features: {
            cod: true,
            insurance: true,
            tracking: true,
            sameDay: false,
          },
          coverage: 'Nationwide',
          isActive: true,
        },
        {
          id: 'JNT',
          name: 'J&T Express',
          logo: '/logos/jnt.png',
          services: [
            {
              code: 'STANDARD',
              name: 'Standard Express',
              type: 'regular',
              estimatedDays: '2-4',
            },
            {
              code: 'ECONOMY',
              name: 'Economy Express',
              type: 'economy',
              estimatedDays: '3-6',
            },
            {
              code: 'SPECIAL',
              name: 'Special Goods Express',
              type: 'express',
              estimatedDays: '1-2',
            },
          ],
          features: {
            cod: true,
            insurance: true,
            tracking: true,
            sameDay: false,
          },
          coverage: 'Nationwide',
          isActive: true,
        },
        {
          id: 'SICEPAT',
          name: 'SiCepat Ekspres',
          logo: '/logos/sicepat.png',
          services: [
            {
              code: 'REG',
              name: 'Regular',
              type: 'regular',
              estimatedDays: '2-4',
            },
            {
              code: 'BEST',
              name: 'BEST',
              type: 'express',
              estimatedDays: '1-2',
            },
            {
              code: 'CARGO',
              name: 'Cargo',
              type: 'cargo',
              estimatedDays: '3-7',
            },
          ],
          features: {
            cod: true,
            insurance: true,
            tracking: true,
            sameDay: true,
          },
          coverage: 'Nationwide',
          isActive: true,
        },
      ];

      const filteredCarriers =
        active !== undefined
          ? carriers.filter(carrier => carrier.isActive === active)
          : carriers;

      return {
        success: true,
        data: filteredCarriers,
        count: filteredCarriers.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get carriers: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== SHIPPING LABELS ====================

  @Get('labels')
  @ApiOperation({ summary: 'Get shipping labels' })
  @ApiResponse({
    status: 200,
    description: 'Shipping labels retrieved successfully',
  })
  @ApiQuery({ name: 'orderId', type: 'string', required: false })
  @ApiQuery({ name: 'trackingNumber', type: 'string', required: false })
  @ApiQuery({ name: 'carrierId', type: 'string', required: false })
  @ApiQuery({ name: 'status', type: 'string', required: false })
  @ApiQuery({ name: 'fromDate', type: 'string', required: false })
  @ApiQuery({ name: 'toDate', type: 'string', required: false })
  @ApiQuery({ name: 'limit', type: 'number', required: false })
  @ApiQuery({ name: 'offset', type: 'number', required: false })
  @ApiQuery({ name: 'includeTracking', type: 'boolean', required: false })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getShippingLabels(
    @CurrentUser() user: any,
    @Query() query: ShippingLabelsQueryDto,
  ) {
    try {
      // Mock implementation - in production this would use repository
      const mockLabels = [
        {
          id: 'label-1',
          orderId: 'order-1',
          orderNumber: 'ORD-2024-001',
          trackingNumber: 'JNE12345678901',
          carrierId: 'JNE',
          carrierName: 'JNE (Jalur Nugraha Ekakurir)',
          serviceName: 'Regular Service',
          status: 'shipped',
          totalCost: 15000,
          senderAddress: {
            name: 'Toko ABC',
            city: 'Jakarta',
            state: 'DKI Jakarta',
          },
          recipientAddress: {
            name: 'John Doe',
            city: 'Surabaya',
            state: 'Jawa Timur',
          },
          packageInfo: {
            weight: 1000,
            pieces: 1,
            content: 'Electronics',
          },
          estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          generatedAt: new Date(),
          shippedAt: new Date(),
        },
      ];

      return {
        success: true,
        data: mockLabels,
        pagination: {
          total: mockLabels.length,
          limit: query.limit,
          offset: query.offset,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get shipping labels: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('labels/:labelId')
  @ApiOperation({ summary: 'Get shipping label by ID' })
  @ApiResponse({
    status: 200,
    description: 'Shipping label retrieved successfully',
  })
  @ApiParam({ name: 'labelId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getShippingLabelById(
    @CurrentUser() user: any,
    @Param('labelId') labelId: string,
  ) {
    try {
      const shippingLabel = await this.shippingService.getShippingLabelById(
        user.tenantId,
        labelId,
      );

      return {
        success: true,
        data: shippingLabel,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get shipping label: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('labels')
  @ApiOperation({ summary: 'Create shipping label' })
  @ApiResponse({
    status: 201,
    description: 'Shipping label created successfully',
  })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createShippingLabel(
    @CurrentUser() user: any,
    @Body() createDto: CreateShippingLabelDto,
  ) {
    try {
      const shippingLabel = await this.shippingService.createShippingLabel(
        user.tenantId,
        createDto,
      );

      return {
        success: true,
        data: shippingLabel,
        message: 'Shipping label created successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create shipping label: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('labels/:labelId/generate')
  @ApiOperation({ summary: 'Generate shipping label with carrier' })
  @ApiResponse({
    status: 200,
    description: 'Shipping label generated successfully',
  })
  @ApiParam({ name: 'labelId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async generateShippingLabel(
    @CurrentUser() user: any,
    @Param('labelId') labelId: string,
  ) {
    try {
      const shippingLabel = await this.shippingService.generateShippingLabel(
        user.tenantId,
        labelId,
      );

      return {
        success: true,
        data: shippingLabel,
        message: 'Shipping label generated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate shipping label: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('labels/:labelId/download')
  @ApiOperation({ summary: 'Download shipping label PDF' })
  @ApiResponse({ status: 200, description: 'Label PDF download URL' })
  @ApiParam({ name: 'labelId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async downloadShippingLabel(
    @CurrentUser() user: any,
    @Param('labelId') labelId: string,
  ) {
    try {
      const shippingLabel = await this.shippingService.getShippingLabelById(
        user.tenantId,
        labelId,
      );

      if (!shippingLabel.labelUrl) {
        throw new HttpException(
          {
            success: false,
            error: 'Label not yet generated',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: {
          labelUrl: shippingLabel.labelUrl,
          trackingNumber: shippingLabel.trackingNumber,
          format: shippingLabel.labelFormat,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get label download URL: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('labels/:labelId')
  @ApiOperation({ summary: 'Cancel shipping label' })
  @ApiResponse({
    status: 200,
    description: 'Shipping label cancelled successfully',
  })
  @ApiParam({ name: 'labelId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async cancelShippingLabel(
    @CurrentUser() user: any,
    @Param('labelId') labelId: string,
    @Body() cancelDto: CancelShipmentDto,
  ) {
    try {
      const shippingLabel = await this.shippingService.getShippingLabelById(
        user.tenantId,
        labelId,
      );

      if (!shippingLabel.canBeCancelled) {
        throw new HttpException(
          {
            success: false,
            error: 'Shipping label cannot be cancelled in current status',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Call appropriate carrier service for cancellation
      let result;
      switch (shippingLabel.carrierId.toUpperCase()) {
        case 'JNE':
          // Would need credentials - this is simplified
          result = { success: true, message: 'Cancelled with JNE' };
          break;
        case 'JNT':
          // Would need credentials - this is simplified
          result = { success: true, message: 'Cancelled with J&T' };
          break;
        default:
          throw new HttpException(
            {
              success: false,
              error: 'Carrier cancellation not supported',
            },
            HttpStatus.BAD_REQUEST,
          );
      }

      return {
        success: true,
        data: result,
        message: 'Shipping label cancelled successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel shipping label: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== TRACKING ====================

  @Get('tracking/:trackingNumber')
  @ApiOperation({ summary: 'Get tracking information for a package' })
  @ApiResponse({
    status: 200,
    description: 'Tracking information retrieved successfully',
  })
  @ApiParam({ name: 'trackingNumber', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getTrackingInfo(
    @CurrentUser() user: any,
    @Param('trackingNumber') trackingNumber: string,
  ) {
    try {
      const trackingHistory = await this.shippingService.getTrackingHistory(
        user.tenantId,
        trackingNumber,
      );

      // Get current status (latest tracking entry)
      const currentStatus = trackingHistory[0];
      const deliveryProgress = 0; // Progress calculation not implemented yet

      return {
        success: true,
        data: {
          trackingNumber,
          currentStatus: currentStatus?.status,
          currentDescription: currentStatus?.description,
          deliveryProgress,
          isDelivered: currentStatus?.isDelivered || false,
          estimatedDeliveryDate: null, // Not available at tracking level
          history: trackingHistory,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get tracking info: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('tracking/update')
  @ApiOperation({ summary: 'Update tracking information (webhook endpoint)' })
  @ApiResponse({ status: 200, description: 'Tracking updated successfully' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // In production, this might be called by carrier webhooks
  async updateTracking(
    @CurrentUser() user: any,
    @Body() updates: UpdateTrackingDto[],
  ) {
    try {
      const trackingUpdates = updates.map(update => ({
        ...update,
        status: update.status as TrackingStatus,
        eventTime: new Date(update.eventTime),
      }));

      await this.shippingService.updateTracking(user.tenantId, trackingUpdates);

      return {
        success: true,
        message: `Updated tracking for ${updates.length} packages`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update tracking: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('tracking/:trackingNumber/refresh')
  @ApiOperation({ summary: 'Refresh tracking from carrier API' })
  @ApiResponse({ status: 200, description: 'Tracking refreshed successfully' })
  @ApiParam({ name: 'trackingNumber', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async refreshTracking(
    @CurrentUser() user: any,
    @Param('trackingNumber') trackingNumber: string,
  ) {
    try {
      // Mock implementation - in production this would call carrier APIs
      const mockTrackingData = {
        trackingNumber,
        carrier: 'JNE',
        status: 'in_transit',
        lastUpdate: new Date(),
        events: [
          {
            time: new Date(),
            status: 'picked_up',
            description: 'Package picked up from sender',
            location: 'Jakarta',
          },
          {
            time: new Date(Date.now() + 60 * 60 * 1000),
            status: 'in_transit',
            description: 'Package in transit to destination hub',
            location: 'Jakarta Hub',
          },
        ],
      };

      return {
        success: true,
        data: mockTrackingData,
        message: 'Tracking information refreshed',
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh tracking: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== ANALYTICS & REPORTING ====================

  @Get('analytics')
  @ApiOperation({ summary: 'Get shipping analytics' })
  @ApiResponse({
    status: 200,
    description: 'Shipping analytics retrieved successfully',
  })
  @ApiQuery({ name: 'fromDate', type: 'string', required: false })
  @ApiQuery({ name: 'toDate', type: 'string', required: false })
  @ApiQuery({
    name: 'carrierIds',
    type: 'string',
    isArray: true,
    required: false,
  })
  @ApiQuery({
    name: 'serviceTypes',
    enum: ShippingServiceType,
    isArray: true,
    required: false,
  })
  @ApiQuery({ name: 'includeDetails', type: 'boolean', required: false })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getShippingAnalytics(
    @CurrentUser() user: any,
    @Query() query: ShippingAnalyticsQueryDto,
  ) {
    try {
      const dateRange =
        query.fromDate && query.toDate
          ? {
              from: new Date(query.fromDate),
              to: new Date(query.toDate),
            }
          : undefined;

      const analytics = await this.shippingService.getShippingAnalytics(
        user.tenantId,
        dateRange,
      );

      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get shipping analytics: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/costs')
  @ApiOperation({ summary: 'Get shipping cost analysis' })
  @ApiResponse({
    status: 200,
    description: 'Cost analysis retrieved successfully',
  })
  @ApiQuery({
    name: 'period',
    enum: ['day', 'week', 'month', 'quarter'],
    required: false,
  })
  @ApiQuery({
    name: 'groupBy',
    enum: ['carrier', 'service', 'location'],
    required: false,
  })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getShippingCostAnalysis(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'quarter' = 'month',
    @Query('groupBy') groupBy: 'carrier' | 'service' | 'location' = 'carrier',
  ) {
    try {
      // Mock cost analysis data
      const costAnalysis = {
        period,
        groupBy,
        totalCost: 15750000, // IDR
        totalShipments: 1250,
        averageCostPerShipment: 12600,
        breakdown: [
          {
            category: 'JNE',
            shipments: 750,
            totalCost: 9450000,
            averageCost: 12600,
            percentage: 60.0,
          },
          {
            category: 'J&T Express',
            shipments: 350,
            totalCost: 4200000,
            averageCost: 12000,
            percentage: 26.7,
          },
          {
            category: 'SiCepat',
            shipments: 150,
            totalCost: 2100000,
            averageCost: 14000,
            percentage: 13.3,
          },
        ],
        trends: {
          daily: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            cost: Math.floor(400000 + Math.random() * 200000),
            shipments: Math.floor(30 + Math.random() * 20),
          })),
        },
      };

      return {
        success: true,
        data: costAnalysis,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get cost analysis: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/performance')
  @ApiOperation({ summary: 'Get carrier performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics retrieved successfully',
  })
  @ApiQuery({
    name: 'period',
    enum: ['week', 'month', 'quarter'],
    required: false,
  })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getCarrierPerformance(
    @CurrentUser() user: any,
    @Query('period') period: 'week' | 'month' | 'quarter' = 'month',
  ) {
    try {
      // Mock performance data
      const performance = {
        period,
        carriers: [
          {
            carrierId: 'JNE',
            carrierName: 'JNE (Jalur Nugraha Ekakurir)',
            metrics: {
              onTimeDeliveryRate: 94.5,
              averageDeliveryDays: 2.8,
              customerSatisfaction: 4.2,
              costEfficiency: 87.3,
              trackingAccuracy: 98.1,
            },
            shipmentCount: 750,
            totalCost: 9450000,
            trends: {
              onTimeRate: [93.2, 94.1, 95.0, 94.5],
              deliveryDays: [3.1, 2.9, 2.7, 2.8],
              satisfaction: [4.0, 4.1, 4.3, 4.2],
            },
          },
          {
            carrierId: 'JNT',
            carrierName: 'J&T Express',
            metrics: {
              onTimeDeliveryRate: 91.2,
              averageDeliveryDays: 3.2,
              customerSatisfaction: 4.0,
              costEfficiency: 89.1,
              trackingAccuracy: 96.8,
            },
            shipmentCount: 350,
            totalCost: 4200000,
            trends: {
              onTimeRate: [90.1, 90.8, 91.5, 91.2],
              deliveryDays: [3.5, 3.3, 3.1, 3.2],
              satisfaction: [3.8, 3.9, 4.1, 4.0],
            },
          },
        ],
        overall: {
          averageOnTimeRate: 93.2,
          averageDeliveryDays: 2.9,
          averageSatisfaction: 4.1,
          totalShipments: 1100,
        },
      };

      return {
        success: true,
        data: performance,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get carrier performance: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== UTILITIES ====================

  @Get('validate/address')
  @ApiOperation({ summary: 'Validate shipping address' })
  @ApiResponse({ status: 200, description: 'Address validation result' })
  @ApiQuery({ name: 'postalCode', type: 'string' })
  @ApiQuery({ name: 'city', type: 'string' })
  @ApiQuery({ name: 'state', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async validateAddress(
    @CurrentUser() user: any,
    @Query('postalCode') postalCode: string,
    @Query('city') city: string,
    @Query('state') state: string,
  ) {
    try {
      // Mock address validation
      const isValidPostalCode = /^[0-9]{5}$/.test(postalCode);
      const validCities = [
        'Jakarta',
        'Surabaya',
        'Bandung',
        'Medan',
        'Bekasi',
        'Tangerang',
      ];
      const isValidCity = validCities.some(validCity =>
        city.toLowerCase().includes(validCity.toLowerCase()),
      );

      const validation = {
        isValid: isValidPostalCode && isValidCity,
        postalCode: {
          isValid: isValidPostalCode,
          message: isValidPostalCode
            ? 'Valid postal code'
            : 'Invalid postal code format (should be 5 digits)',
        },
        city: {
          isValid: isValidCity,
          message: isValidCity
            ? 'Valid city'
            : 'City not found in coverage area',
          suggestions: isValidCity
            ? []
            : validCities.filter(validCity =>
                validCity
                  .toLowerCase()
                  .includes(city.toLowerCase().substring(0, 3)),
              ),
        },
        coverageInfo: {
          hasRegularService: true,
          hasExpressService: isValidCity,
          hasSameDayService: ['Jakarta', 'Surabaya'].includes(city),
          estimatedDays: isValidCity ? '1-3 days' : '3-7 days',
        },
      };

      return {
        success: true,
        data: validation,
      };
    } catch (error) {
      this.logger.error(
        `Failed to validate address: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('calculate/dimensions')
  @ApiOperation({
    summary: 'Calculate volumetric weight and chargeable weight',
  })
  @ApiResponse({ status: 200, description: 'Weight calculations completed' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async calculateWeights(
    @CurrentUser() user: any,
    @Body()
    data: {
      actualWeight: number; // in grams
      length: number; // in cm
      width: number; // in cm
      height: number; // in cm
      carrier?: string;
    },
  ) {
    try {
      const { actualWeight, length, width, height, carrier = 'JNE' } = data;

      // Different carriers use different volumetric formulas
      let volumetricWeight: number;
      switch (carrier.toUpperCase()) {
        case 'JNE':
          volumetricWeight = (length * width * height) / 6000;
          break;
        case 'JNT':
          volumetricWeight = (length * width * height) / 5000;
          break;
        case 'SICEPAT':
          volumetricWeight = (length * width * height) / 6000;
          break;
        default:
          volumetricWeight = (length * width * height) / 6000;
      }

      const chargeableWeight = Math.max(actualWeight, volumetricWeight);
      const volume = (length * width * height) / 1000; // in liters

      const calculations = {
        actualWeight: actualWeight, // grams
        volumetricWeight: Math.round(volumetricWeight), // grams
        chargeableWeight: Math.round(chargeableWeight), // grams
        volume: Math.round(volume * 100) / 100, // liters, rounded to 2 decimals
        carrier,
        formula:
          carrier.toUpperCase() === 'JNT'
            ? 'L × W × H ÷ 5000'
            : 'L × W × H ÷ 6000',
        recommendation:
          chargeableWeight > actualWeight
            ? 'Consider optimizing package dimensions to reduce volumetric weight'
            : 'Package dimensions are efficient',
      };

      return {
        success: true,
        data: calculations,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate weights: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
