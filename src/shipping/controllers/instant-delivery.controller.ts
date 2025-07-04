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
  IsLatitude,
  IsLongitude,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/entities/user.entity';

// Services
import {
  InstantDeliveryService,
  InstantDeliveryQuoteRequest,
  InstantDeliveryRequest,
} from '../services/instant-delivery.service';

// DTOs
export class LocationDto {
  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

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
}

export class PackageDto {
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

  @IsNumber()
  @Min(0)
  value: number; // in IDR

  @IsString()
  description: string;
}

export class GetInstantDeliveryQuotesDto {
  @ValidateNested()
  @Type(() => LocationDto)
  pickup: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  delivery: LocationDto;

  @ValidateNested()
  @Type(() => PackageDto)
  package: PackageDto;

  @IsOptional()
  @IsArray()
  @IsEnum(['instant', 'same_day', 'express'], { each: true })
  serviceTypes?: ('instant' | 'same_day' | 'express')[];

  @IsOptional()
  @IsArray()
  @IsEnum(['gojek', 'grab'], { each: true })
  providers?: ('gojek' | 'grab')[];
}

export class ContactPersonDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DeliveryLocationDto {
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

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ValidateNested()
  @Type(() => ContactPersonDto)
  contactPerson: ContactPersonDto;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInstantDeliveryDto {
  @IsString()
  orderId: string;

  @IsEnum(['gojek', 'grab'])
  provider: 'gojek' | 'grab';

  @IsEnum(['instant', 'same_day', 'express'])
  serviceType: 'instant' | 'same_day' | 'express';

  @ValidateNested()
  @Type(() => DeliveryLocationDto)
  pickup: DeliveryLocationDto;

  @ValidateNested()
  @Type(() => DeliveryLocationDto)
  delivery: DeliveryLocationDto;

  @ValidateNested()
  @Type(() => PackageDto)
  package: PackageDto & { quantity?: number };

  @IsEnum(['cash', 'cashless', 'gopay', 'corporate'])
  paymentMethod: 'cash' | 'cashless' | 'gopay' | 'corporate';

  @IsOptional()
  @IsBoolean()
  isCod?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialInstructions?: string[];
}

export class UpdateTrackingDto {
  @IsEnum(['gojek', 'grab'])
  provider: 'gojek' | 'grab';
}

export class CancelDeliveryDto {
  @IsEnum(['gojek', 'grab'])
  provider: 'gojek' | 'grab';

  @IsString()
  reason: string;
}

@ApiTags('Instant Delivery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('instant-delivery')
export class InstantDeliveryController {
  private readonly logger = new Logger(InstantDeliveryController.name);

  constructor(
    private readonly instantDeliveryService: InstantDeliveryService,
  ) {}

  @Post('quotes')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get instant delivery quotes from all providers' })
  @ApiResponse({
    status: 200,
    description: 'Instant delivery quotes retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: GetInstantDeliveryQuotesDto })
  async getInstantDeliveryQuotes(
    @CurrentUser() user: any,
    @Body() getQuotesDto: GetInstantDeliveryQuotesDto,
  ) {
    try {
      this.logger.log(
        `Getting instant delivery quotes for tenant ${user.tenantId}`,
      );

      const request: InstantDeliveryQuoteRequest = {
        pickup: getQuotesDto.pickup,
        delivery: getQuotesDto.delivery,
        package: getQuotesDto.package,
        serviceTypes: getQuotesDto.serviceTypes,
        providers: getQuotesDto.providers,
      };

      const quotes = await this.instantDeliveryService.getInstantDeliveryQuotes(
        user.tenantId,
        request,
      );

      return {
        success: true,
        data: quotes,
        meta: {
          total: quotes.length,
          availableQuotes: quotes.filter(q => q.availability.isServiceable)
            .length,
          providers: [...new Set(quotes.map(q => q.provider))],
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get instant delivery quotes: ${error.message}`,
        error.stack,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create instant delivery shipment' })
  @ApiResponse({
    status: 201,
    description: 'Instant delivery created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: CreateInstantDeliveryDto })
  async createInstantDelivery(
    @CurrentUser() user: any,
    @Body() createDeliveryDto: CreateInstantDeliveryDto,
  ) {
    try {
      this.logger.log(
        `Creating instant delivery for order ${createDeliveryDto.orderId}`,
      );

      const request: InstantDeliveryRequest = {
        orderId: createDeliveryDto.orderId,
        provider: createDeliveryDto.provider,
        serviceType: createDeliveryDto.serviceType,
        pickup: {
          name: createDeliveryDto.pickup.contactPerson.name,
          phone: createDeliveryDto.pickup.contactPerson.phone,
          address: createDeliveryDto.pickup.address,
          district: createDeliveryDto.pickup.district,
          city: createDeliveryDto.pickup.city,
          state: createDeliveryDto.pickup.state,
          postalCode: createDeliveryDto.pickup.postalCode,
          latitude: createDeliveryDto.pickup.latitude,
          longitude: createDeliveryDto.pickup.longitude,
          notes: createDeliveryDto.pickup.notes,
        },
        delivery: {
          name: createDeliveryDto.delivery.contactPerson.name,
          phone: createDeliveryDto.delivery.contactPerson.phone,
          address: createDeliveryDto.delivery.address,
          district: createDeliveryDto.delivery.district,
          city: createDeliveryDto.delivery.city,
          state: createDeliveryDto.delivery.state,
          postalCode: createDeliveryDto.delivery.postalCode,
          latitude: createDeliveryDto.delivery.latitude,
          longitude: createDeliveryDto.delivery.longitude,
          notes: createDeliveryDto.delivery.notes,
        },
        package: createDeliveryDto.package,
        paymentMethod: createDeliveryDto.paymentMethod,
        isCod: createDeliveryDto.isCod,
        codAmount: createDeliveryDto.codAmount,
        scheduledAt: createDeliveryDto.scheduledAt
          ? new Date(createDeliveryDto.scheduledAt)
          : undefined,
        specialInstructions: createDeliveryDto.specialInstructions,
      };

      const shippingLabel =
        await this.instantDeliveryService.createInstantDelivery(
          user.tenantId,
          request,
        );

      return {
        success: true,
        data: {
          shippingLabelId: shippingLabel.id,
          trackingNumber: shippingLabel.trackingNumber,
          carrierId: shippingLabel.carrierId,
          carrierName: shippingLabel.carrierName,
          serviceType: shippingLabel.serviceType,
          serviceName: shippingLabel.serviceName,
          status: shippingLabel.status,
          totalCost: shippingLabel.totalCost,
          estimatedPickupDate: shippingLabel.estimatedPickupDate,
          estimatedDeliveryDate: shippingLabel.estimatedDeliveryDate,
          labelUrl: shippingLabel.labelUrl,
          carrierData: shippingLabel.carrierData,
        },
        message: 'Instant delivery created successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create instant delivery: ${error.message}`,
        error.stack,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':trackingNumber/tracking')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Update instant delivery tracking information' })
  @ApiResponse({ status: 200, description: 'Tracking updated successfully' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiParam({
    name: 'trackingNumber',
    description: 'Tracking number of the delivery',
  })
  @ApiBody({ type: UpdateTrackingDto })
  async updateTracking(
    @CurrentUser() user: any,
    @Param('trackingNumber') trackingNumber: string,
    @Body() updateTrackingDto: UpdateTrackingDto,
  ) {
    try {
      this.logger.log(
        `Updating tracking for ${trackingNumber} (${updateTrackingDto.provider})`,
      );

      await this.instantDeliveryService.updateInstantDeliveryTracking(
        user.tenantId,
        trackingNumber,
        updateTrackingDto.provider,
      );

      return {
        success: true,
        message: 'Tracking updated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to update tracking: ${error.message}`,
        error.stack,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':trackingNumber')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel instant delivery' })
  @ApiResponse({ status: 200, description: 'Delivery cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiParam({
    name: 'trackingNumber',
    description: 'Tracking number of the delivery',
  })
  @ApiBody({ type: CancelDeliveryDto })
  async cancelDelivery(
    @CurrentUser() user: any,
    @Param('trackingNumber') trackingNumber: string,
    @Body() cancelDeliveryDto: CancelDeliveryDto,
  ) {
    try {
      this.logger.log(
        `Cancelling delivery ${trackingNumber} (${cancelDeliveryDto.provider})`,
      );

      await this.instantDeliveryService.cancelInstantDelivery(
        user.tenantId,
        trackingNumber,
        cancelDeliveryDto.provider,
        cancelDeliveryDto.reason,
      );

      return {
        success: true,
        message: 'Delivery cancelled successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel delivery: ${error.message}`,
        error.stack,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('providers/:provider/connection')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Test instant delivery provider connection' })
  @ApiResponse({ status: 200, description: 'Connection test completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiParam({
    name: 'provider',
    enum: ['gojek', 'grab'],
    description: 'Instant delivery provider',
  })
  async testProviderConnection(
    @CurrentUser() user: any,
    @Param('provider') provider: 'gojek' | 'grab',
  ) {
    try {
      this.logger.log(
        `Testing ${provider} connection for tenant ${user.tenantId}`,
      );

      let result: { success: boolean; message: string };

      if (provider === 'gojek') {
        // Note: We would need to expose this method from GojekShippingService
        result = {
          success: true,
          message: 'Gojek connection test not implemented yet',
        };
      } else if (provider === 'grab') {
        // Note: We would need to expose this method from GrabShippingService
        result = {
          success: true,
          message: 'Grab connection test not implemented yet',
        };
      } else {
        throw new HttpException('Unsupported provider', HttpStatus.BAD_REQUEST);
      }

      return {
        success: result.success,
        data: {
          provider,
          connected: result.success,
          message: result.message,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to test ${provider} connection: ${error.message}`,
        error.stack,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('providers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get available instant delivery providers' })
  @ApiResponse({ status: 200, description: 'Providers retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProviders(@CurrentUser() user: any) {
    try {
      const providers = [
        {
          id: 'gojek',
          name: 'Gojek',
          description: 'Instant delivery and same-day delivery service',
          serviceTypes: ['instant', 'same_day', 'next_day'],
          features: {
            instantDelivery: true,
            scheduledDelivery: true,
            codSupport: true,
            realTimeTracking: true,
            driverContact: true,
          },
          maxWeight: 20000, // 20kg
          maxDimensions: {
            length: 60,
            width: 45,
            height: 45,
          },
        },
        {
          id: 'grab',
          name: 'Grab',
          description: 'Express delivery with multiple service options',
          serviceTypes: ['instant', 'same_day', 'express'],
          features: {
            instantDelivery: true,
            scheduledDelivery: true,
            codSupport: true,
            realTimeTracking: true,
            driverContact: true,
          },
          maxWeight: 50000, // 50kg
          maxDimensions: {
            length: 100,
            width: 80,
            height: 80,
          },
        },
      ];

      return {
        success: true,
        data: providers,
        meta: {
          total: providers.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get providers: ${error.message}`,
        error.stack,
      );
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
