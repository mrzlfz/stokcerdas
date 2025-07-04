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
  OrderStatus,
  OrderType,
  PaymentStatus,
  FulfillmentStatus,
} from '../entities/order.entity';
import { UserRole } from '../../users/entities/user.entity';

// Services
import { OrdersService } from '../services/orders.service';
import { OrderFulfillmentService } from '../services/order-fulfillment.service';
// Note: OrderRoutingService to be implemented
// import { OrderRoutingService } from '../services/order-routing.service';

// DTOs
export class CreateOrderItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsString()
  sku: string;

  @IsString()
  productName: string;

  @IsOptional()
  @IsString()
  variantName?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsObject()
  attributes?: any;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  externalItemId?: string;

  @IsOptional()
  @IsObject()
  externalData?: any;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  externalOrderId?: string;

  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @IsString()
  channelName?: string;

  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsString()
  customerName: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsObject()
  customerInfo?: any;

  @IsOptional()
  @IsObject()
  shippingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
    notes?: string;
  };

  @IsOptional()
  @IsObject()
  billingAddress?: any;

  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @IsOptional()
  @IsString()
  shippingCarrier?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsObject()
  channelMetadata?: any;

  @IsOptional()
  @IsObject()
  externalData?: any;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(FulfillmentStatus)
  fulfillmentStatus?: FulfillmentStatus;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsObject()
  customerInfo?: any;

  @IsOptional()
  @IsObject()
  shippingAddress?: any;

  @IsOptional()
  @IsObject()
  billingAddress?: any;

  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @IsOptional()
  @IsString()
  shippingCarrier?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsDateString()
  estimatedDeliveryDate?: string;

  @IsOptional()
  @IsDateString()
  actualDeliveryDate?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsUUID()
  processingLocationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsObject()
  channelMetadata?: any;

  @IsOptional()
  @IsObject()
  externalData?: any;
}

export class OrdersQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  status?: OrderStatus | OrderStatus[];

  @IsOptional()
  @IsEnum(PaymentStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  paymentStatus?: PaymentStatus | PaymentStatus[];

  @IsOptional()
  @IsEnum(FulfillmentStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  fulfillmentStatus?: FulfillmentStatus | FulfillmentStatus[];

  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;

  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @IsString()
  channelName?: string;

  @IsOptional()
  @IsString()
  externalOrderId?: string;

  @IsOptional()
  @IsDateString()
  orderDateFrom?: string;

  @IsOptional()
  @IsDateString()
  orderDateTo?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value.split(',')))
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  hasExternalOrderId?: boolean;

  @IsOptional()
  @IsEnum(['pending', 'synced', 'failed'])
  syncStatus?: 'pending' | 'synced' | 'failed';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @IsEnum(['orderDate', 'createdAt', 'totalAmount', 'status', 'priority'])
  sortBy?: 'orderDate' | 'createdAt' | 'totalAmount' | 'status' | 'priority';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeItems?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeStatusHistory?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeMetrics?: boolean;
}

export class BulkOrderActionDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  orderIds: string[];

  @IsEnum(['update_status', 'assign_location', 'add_tags', 'export', 'sync'])
  action: 'update_status' | 'assign_location' | 'add_tags' | 'export' | 'sync';

  @IsOptional()
  @IsObject()
  params?: any;
}

export class CancelOrderDto {
  @IsString()
  reason: string;
}

export class UpdateFulfillmentStatusDto {
  @IsEnum(FulfillmentStatus)
  status: FulfillmentStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly fulfillmentService: OrderFulfillmentService, // private readonly routingService: OrderRoutingService,
  ) {}

  // ==================== HELPER METHODS ====================

  /**
   * Transform OrdersQueryDto (string dates) to OrderListQuery (Date objects)
   */
  private transformQueryDto(query: OrdersQueryDto): any {
    const transformed: any = { ...query };

    // Transform date strings to Date objects
    if (query.orderDateFrom) {
      transformed.orderDateFrom = new Date(query.orderDateFrom);
    }
    if (query.orderDateTo) {
      transformed.orderDateTo = new Date(query.orderDateTo);
    }
    if (query.createdFrom) {
      transformed.createdFrom = new Date(query.createdFrom);
    }
    if (query.createdTo) {
      transformed.createdTo = new Date(query.createdTo);
    }

    return transformed;
  }

  /**
   * Transform CreateOrderDto (string dates) to service CreateOrderDto (Date objects)
   */
  private transformCreateOrderDto(dto: CreateOrderDto): any {
    const transformed: any = { ...dto };

    // Transform date string to Date object
    if (dto.orderDate) {
      transformed.orderDate = new Date(dto.orderDate);
    }

    return transformed;
  }

  /**
   * Transform UpdateOrderDto (string dates) to service UpdateOrderDto (Date objects)
   */
  private transformUpdateOrderDto(dto: UpdateOrderDto): any {
    const transformed: any = { ...dto };

    // Transform date strings to Date objects
    if (dto.estimatedDeliveryDate) {
      transformed.estimatedDeliveryDate = new Date(dto.estimatedDeliveryDate);
    }
    if (dto.actualDeliveryDate) {
      transformed.actualDeliveryDate = new Date(dto.actualDeliveryDate);
    }
    if (dto.paidAt) {
      transformed.paidAt = new Date(dto.paidAt);
    }

    return transformed;
  }

  // ==================== BASIC CRUD OPERATIONS ====================

  @Get()
  @ApiOperation({ summary: 'Get all orders with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiQuery({
    name: 'status',
    enum: OrderStatus,
    required: false,
    isArray: true,
  })
  @ApiQuery({
    name: 'paymentStatus',
    enum: PaymentStatus,
    required: false,
    isArray: true,
  })
  @ApiQuery({
    name: 'fulfillmentStatus',
    enum: FulfillmentStatus,
    required: false,
    isArray: true,
  })
  @ApiQuery({ name: 'orderType', enum: OrderType, required: false })
  @ApiQuery({ name: 'channelId', type: 'string', required: false })
  @ApiQuery({ name: 'search', type: 'string', required: false })
  @ApiQuery({ name: 'limit', type: 'number', required: false })
  @ApiQuery({ name: 'offset', type: 'number', required: false })
  @ApiQuery({ name: 'includeItems', type: 'boolean', required: false })
  @ApiQuery({ name: 'includeMetrics', type: 'boolean', required: false })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getOrders(@CurrentUser() user: any, @Query() query: OrdersQueryDto) {
    try {
      // Convert DTO to service interface by transforming date strings to Date objects
      const serviceQuery = this.transformQueryDto(query);
      const result = await this.ordersService.getOrders(
        user.tenantId,
        serviceQuery,
      );

      return {
        success: true,
        data: result.orders,
        pagination: {
          total: result.total,
          limit: query.limit,
          offset: query.offset,
        },
        summary: result.summary,
      };
    } catch (error) {
      this.logger.error(`Failed to get orders: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiParam({ name: 'orderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getOrderById(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
  ) {
    try {
      const order = await this.ordersService.getOrderById(
        user.tenantId,
        orderId,
      );

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(`Failed to get order: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('number/:orderNumber')
  @ApiOperation({ summary: 'Get order by order number' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiParam({ name: 'orderNumber', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getOrderByNumber(
    @CurrentUser() user: any,
    @Param('orderNumber') orderNumber: string,
  ) {
    try {
      const order = await this.ordersService.getOrderByNumber(
        user.tenantId,
        orderNumber,
      );

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get order by number: ${error.message}`,
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

  @Get('external/:externalOrderId')
  @ApiOperation({ summary: 'Get order by external order ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiParam({ name: 'externalOrderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getOrderByExternalId(
    @CurrentUser() user: any,
    @Param('externalOrderId') externalOrderId: string,
  ) {
    try {
      const order = await this.ordersService.getOrderByExternalId(
        user.tenantId,
        externalOrderId,
      );

      if (!order) {
        throw new HttpException(
          {
            success: false,
            error: 'Order not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get order by external ID: ${error.message}`,
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

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async createOrder(
    @CurrentUser() user: any,
    @Body() createDto: CreateOrderDto,
  ) {
    try {
      const transformedDto = this.transformCreateOrderDto(createDto);
      const order = await this.ordersService.createOrder(
        user.tenantId,
        transformedDto,
      );

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create order: ${error.message}`,
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

  @Put(':orderId')
  @ApiOperation({ summary: 'Update order' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiParam({ name: 'orderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async updateOrder(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Body() updateDto: UpdateOrderDto,
  ) {
    try {
      const transformedDto = this.transformUpdateOrderDto(updateDto);
      const order = await this.ordersService.updateOrder(
        user.tenantId,
        orderId,
        transformedDto,
        user.id,
      );

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update order: ${error.message}`,
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

  // ==================== ORDER STATUS MANAGEMENT ====================

  @Patch(':orderId/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
  })
  @ApiParam({ name: 'orderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async updateOrderStatus(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Body() body: { status: OrderStatus; reason?: string },
  ) {
    try {
      const order = await this.ordersService.updateOrder(
        user.tenantId,
        orderId,
        { status: body.status },
        user.id,
      );

      return {
        success: true,
        data: order,
        message: `Order status updated to ${body.status}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update order status: ${error.message}`,
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

  @Post(':orderId/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiParam({ name: 'orderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async cancelOrder(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Body() cancelDto: CancelOrderDto,
  ) {
    try {
      const order = await this.ordersService.cancelOrder(
        user.tenantId,
        orderId,
        cancelDto.reason,
        user.id,
      );

      return {
        success: true,
        data: order,
        message: 'Order cancelled successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel order: ${error.message}`,
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

  // ==================== FULFILLMENT MANAGEMENT ====================

  @Get(':orderId/fulfillment/options')
  @ApiOperation({ summary: 'Get fulfillment options for order' })
  @ApiResponse({
    status: 200,
    description: 'Fulfillment options retrieved successfully',
  })
  @ApiParam({ name: 'orderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getFulfillmentOptions(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
  ) {
    try {
      const options = await this.fulfillmentService.getFulfillmentOptions(
        user.tenantId,
        orderId,
      );

      return {
        success: true,
        data: options,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get fulfillment options: ${error.message}`,
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

  @Post(':orderId/fulfillment/assign')
  @ApiOperation({ summary: 'Assign order to fulfillment location' })
  @ApiResponse({
    status: 200,
    description: 'Fulfillment assigned successfully',
  })
  @ApiParam({ name: 'orderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async assignFulfillment(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Body() body: { locationId?: string; force?: boolean },
  ) {
    try {
      const assignment = await this.fulfillmentService.assignOrderFulfillment(
        user.tenantId,
        orderId,
        body.locationId,
        body.force || false,
      );

      return {
        success: true,
        data: assignment,
        message: 'Fulfillment assigned successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to assign fulfillment: ${error.message}`,
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

  @Patch(':orderId/fulfillment/status')
  @ApiOperation({ summary: 'Update fulfillment status' })
  @ApiResponse({
    status: 200,
    description: 'Fulfillment status updated successfully',
  })
  @ApiParam({ name: 'orderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async updateFulfillmentStatus(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Body() updateDto: UpdateFulfillmentStatusDto,
  ) {
    try {
      await this.fulfillmentService.updateFulfillmentStatus(
        user.tenantId,
        orderId,
        updateDto.status,
        updateDto.notes,
        user.id,
      );

      return {
        success: true,
        message: `Fulfillment status updated to ${updateDto.status}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update fulfillment status: ${error.message}`,
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

  // ==================== ROUTING & MULTI-CHANNEL ====================
  // Note: Routing functionality to be implemented

  /*
  @Post(':orderId/route')
  @ApiOperation({ summary: 'Route order through intelligent routing system' })
  @ApiResponse({ status: 200, description: 'Order routed successfully' })
  @ApiParam({ name: 'orderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async routeOrder(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Body() body: { forceReRoute?: boolean; skipRules?: boolean; overrideLocation?: string },
  ) {
    try {
      const routing = await this.routingService.routeOrder(user.tenantId, orderId, body);
      
      return {
        success: true,
        data: routing,
        message: 'Order routed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to route order: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  */

  /*
  @Get('multi-channel/view')
  @ApiOperation({ summary: 'Get multi-channel orders view' })
  @ApiResponse({ status: 200, description: 'Multi-channel orders retrieved successfully' })
  @ApiQuery({ name: 'channelIds', type: 'string', isArray: true, required: false })
  @ApiQuery({ name: 'groupBy', enum: ['channel', 'date', 'status'], required: false })
  @ApiQuery({ name: 'includeMetrics', type: 'boolean', required: false })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getMultiChannelOrders(
    @CurrentUser() user: any,
    @Query() query: any,
  ) {
    try {
      const result = await this.routingService.getMultiChannelOrders(user.tenantId, {
        channelIds: query.channelIds,
        groupBy: query.groupBy,
        includeMetrics: query.includeMetrics === 'true',
      });
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to get multi-channel orders: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  */

  /*
  @Post(':orderId/sync')
  @ApiOperation({ summary: 'Synchronize order status across platforms' })
  @ApiResponse({ status: 200, description: 'Order synchronized successfully' })
  @ApiParam({ name: 'orderId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async synchronizeOrder(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Body() body: { forceSync?: boolean },
  ) {
    try {
      const result = await this.routingService.synchronizeOrderStatus(
        user.tenantId,
        orderId,
        body.forceSync || false,
      );
      
      return {
        success: true,
        data: result,
        message: result.success ? 'Order synchronized successfully' : 'Order sync completed with errors',
      };
    } catch (error) {
      this.logger.error(`Failed to synchronize order: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  */

  //   @Get('conflicts/detect')
  //   @ApiOperation({ summary: 'Detect cross-channel conflicts' })
  //   @ApiResponse({ status: 200, description: 'Conflicts detected successfully' })
  //   @ApiQuery({ name: 'orderId', type: 'string', required: false })
  //   @Roles(UserRole.ADMIN, UserRole.MANAGER)
  //   async detectConflicts(
  //     @CurrentUser() user: any,
  //     @Query('orderId') orderId?: string,
  //   ) {
  //     try {
  //       const conflicts = await this.routingService.detectCrossChannelConflicts(user.tenantId, orderId);
  //
  //       return {
  //         success: true,
  //         data: conflicts,
  //       };
  //     } catch (error) {
  //       this.logger.error(`Failed to detect conflicts: ${error.message}`, error.stack);
  //       throw new HttpException(
  //         {
  //           success: false,
  //           error: error.message,
  //         },
  //         error.status || HttpStatus.INTERNAL_SERVER_ERROR,
  //       );
  //     }
  //   }

  // ==================== BULK OPERATIONS ====================

  @Post('bulk/action')
  @ApiOperation({ summary: 'Perform bulk action on orders' })
  @ApiResponse({
    status: 200,
    description: 'Bulk action completed successfully',
  })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async bulkOrderAction(
    @CurrentUser() user: any,
    @Body() actionDto: BulkOrderActionDto,
  ) {
    try {
      const result = await this.ordersService.bulkAction(
        user.tenantId,
        actionDto,
        user.id,
      );

      return {
        success: true,
        data: result,
        message: `Bulk action completed: ${result.processedCount}/${actionDto.orderIds.length} processed`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to perform bulk action: ${error.message}`,
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

  /*
  @Post('bulk/route')
  @ApiOperation({ summary: 'Perform bulk routing on orders' })
  @ApiResponse({ status: 200, description: 'Bulk routing completed successfully' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async bulkRouting(
    @CurrentUser() user: any,
    @Body() body: {
      orderIds: string[];
      forceReRoute?: boolean;
      applyRules?: string[];
      overrideLocation?: string;
      priority?: number;
    },
  ) {
    try {
      const result = await this.routingService.bulkRouting(user.tenantId, body);
      
      return {
        success: true,
        data: result,
        message: `Bulk routing completed: ${result.processedCount}/${body.orderIds.length} processed`,
      };
    } catch (error) {
      this.logger.error(`Failed to perform bulk routing: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  */

  @Post('fulfillment/batch/optimize')
  @ApiOperation({ summary: 'Optimize batch fulfillment for multiple orders' })
  @ApiResponse({
    status: 200,
    description: 'Batch fulfillment optimized successfully',
  })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async optimizeBatchFulfillment(
    @CurrentUser() user: any,
    @Body()
    body: {
      orderIds: string[];
      constraints?: any;
      optimization?: 'cost' | 'speed' | 'balanced';
    },
  ) {
    try {
      const result = await this.fulfillmentService.optimizeBatchFulfillment(
        user.tenantId,
        body,
      );

      return {
        success: true,
        data: result,
        message: `Batch fulfillment optimized: ${result.assignments.length} assignments created`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to optimize batch fulfillment: ${error.message}`,
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

  // ==================== ANALYTICS & REPORTING ====================

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Get order analytics summary' })
  @ApiResponse({
    status: 200,
    description: 'Analytics summary retrieved successfully',
  })
  @ApiQuery({ name: 'dateFrom', type: 'string', required: false })
  @ApiQuery({ name: 'dateTo', type: 'string', required: false })
  @ApiQuery({
    name: 'groupBy',
    enum: ['day', 'week', 'month'],
    required: false,
  })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getAnalyticsSummary(@CurrentUser() user: any, @Query() query: any) {
    try {
      const filters: any = {};

      if (query.dateFrom) {
        filters.orderDateFrom =
          typeof query.dateFrom === 'string'
            ? new Date(query.dateFrom)
            : query.dateFrom;
      }
      if (query.dateTo) {
        filters.orderDateTo =
          typeof query.dateTo === 'string'
            ? new Date(query.dateTo)
            : query.dateTo;
      }

      const summary = await this.ordersService.getOrderSummary(
        user.tenantId,
        filters,
      );

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get analytics summary: ${error.message}`,
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

  /*
  @Get('dashboard/routing')
  @ApiOperation({ summary: 'Get routing dashboard data' })
  @ApiResponse({ status: 200, description: 'Routing dashboard retrieved successfully' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getRoutingDashboard(
    @CurrentUser() user: any,
  ) {
    try {
      const dashboard = await this.routingService.getRoutingDashboard(user.tenantId);
      
      return {
        success: true,
        data: dashboard,
      };
    } catch (error) {
      this.logger.error(`Failed to get routing dashboard: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  */

  @Get('capacity/locations')
  @ApiOperation({ summary: 'Get location capacity information' })
  @ApiResponse({
    status: 200,
    description: 'Location capacities retrieved successfully',
  })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getLocationCapacities(@CurrentUser() user: any) {
    try {
      const capacities = await this.fulfillmentService.getLocationCapacities(
        user.tenantId,
      );

      return {
        success: true,
        data: capacities,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get location capacities: ${error.message}`,
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

  // ==================== CHANNEL-SPECIFIC OPERATIONS ====================

  @Get('channel/:channelId')
  @ApiOperation({ summary: 'Get orders by channel' })
  @ApiResponse({
    status: 200,
    description: 'Channel orders retrieved successfully',
  })
  @ApiParam({ name: 'channelId', type: 'string' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getOrdersByChannel(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Query() query: OrdersQueryDto,
  ) {
    try {
      const serviceQuery = this.transformQueryDto(query);
      const orders = await this.ordersService.getOrdersByChannel(
        user.tenantId,
        channelId,
        serviceQuery,
      );

      return {
        success: true,
        data: orders,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get orders by channel: ${error.message}`,
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

  @Get('export/:format')
  @ApiOperation({ summary: 'Export orders data' })
  @ApiResponse({ status: 200, description: 'Orders exported successfully' })
  @ApiParam({ name: 'format', enum: ['csv', 'excel', 'pdf'] })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async exportOrders(
    @CurrentUser() user: any,
    @Param('format') format: 'csv' | 'excel' | 'pdf',
    @Query() query: OrdersQueryDto,
  ) {
    try {
      // Implementation would handle actual export generation
      // For now, return success message

      return {
        success: true,
        message: `Export initiated for ${format} format`,
        data: {
          format,
          status: 'initiated',
          downloadUrl: null, // Would be generated in actual implementation
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to export orders: ${error.message}`,
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
}
