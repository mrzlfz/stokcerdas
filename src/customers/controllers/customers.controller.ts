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
  HttpCode,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/entities/user.entity';

import { CustomersService } from '../services/customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
  CustomerResponseDto,
  CustomerListResponseDto,
  CustomerDetailResponseDto,
} from '../dto';

@ApiTags('Customer Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new customer',
    description: 'Create a new customer with comprehensive profile information',
  })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Customer created successfully',
    type: CustomerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid customer data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Customer with same email/phone already exists',
  })
  async create(
    @CurrentUser() user: any,
    @Body() createCustomerDto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    this.logger.log(`Creating customer for tenant ${user.tenantId}`);

    try {
      return await this.customersService.create(
        user.tenantId,
        createCustomerDto,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create customer: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get all customers',
    description: 'Retrieve customers with pagination, filtering, and sorting',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'segment',
    required: false,
    description: 'Filter by segment',
  })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customers retrieved successfully',
    type: CustomerListResponseDto,
  })
  async findAll(
    @CurrentUser() user: any,
    @Query() query: CustomerQueryDto,
  ): Promise<CustomerListResponseDto> {
    this.logger.debug(`Finding customers for tenant ${user.tenantId}`);

    try {
      return await this.customersService.findAll(user.tenantId, query);
    } catch (error) {
      this.logger.error(
        `Failed to find customers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('search')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Search customers',
    description: 'Advanced search customers with multiple criteria',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({
    name: 'includeAnalytics',
    required: false,
    description: 'Include analytics data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results retrieved successfully',
    type: CustomerListResponseDto,
  })
  async search(
    @CurrentUser() user: any,
    @Query('q') searchQuery: string,
    @Query('includeAnalytics') includeAnalytics?: boolean,
  ): Promise<CustomerListResponseDto> {
    this.logger.debug(
      `Searching customers for tenant ${user.tenantId} with query: ${searchQuery}`,
    );

    try {
      const query: CustomerQueryDto = {
        search: searchQuery,
        includeAnalytics: includeAnalytics || false,
        limit: 50, // Higher limit for search results
      };

      return await this.customersService.findAll(user.tenantId, query);
    } catch (error) {
      this.logger.error(
        `Failed to search customers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('analytics/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer analytics summary',
    description: 'Get overall customer analytics and statistics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer analytics summary retrieved successfully',
  })
  async getAnalyticsSummary(@CurrentUser() user: any) {
    this.logger.debug(
      `Getting customer analytics summary for tenant ${user.tenantId}`,
    );

    try {
      // Use an empty query to get overall statistics
      const result = await this.customersService.findAll(user.tenantId, {
        limit: 1,
        includeAnalytics: true,
      });

      return {
        success: true,
        data: result.summary,
        meta: {
          generatedAt: new Date().toISOString(),
          tenantId: user.tenantId,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get analytics summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('segments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer segments distribution',
    description: 'Get distribution of customers across different segments',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer segments retrieved successfully',
  })
  async getSegments(@CurrentUser() user: any) {
    this.logger.debug(`Getting customer segments for tenant ${user.tenantId}`);

    try {
      const result = await this.customersService.findAll(user.tenantId, {
        limit: 1,
      });

      return {
        success: true,
        data: result.summary.topSegments,
        meta: {
          total: result.summary.totalCustomers,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get customer segments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('high-value')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get high-value customers',
    description:
      'Retrieve customers with high lifetime value or marked as high-value segment',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of customers to return',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'High-value customers retrieved successfully',
    type: CustomerListResponseDto,
  })
  async getHighValueCustomers(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ): Promise<CustomerListResponseDto> {
    this.logger.debug(
      `Getting high-value customers for tenant ${user.tenantId}`,
    );

    try {
      const query: CustomerQueryDto = {
        isHighValue: true,
        limit: limit || 20,
        sortBy: 'lifetimeValue' as any,
        sortOrder: 'DESC' as any,
        includeAnalytics: true,
      };

      return await this.customersService.findAll(user.tenantId, query);
    } catch (error) {
      this.logger.error(
        `Failed to get high-value customers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('at-risk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get at-risk customers',
    description: 'Retrieve customers with high churn probability',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of customers to return',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'At-risk customers retrieved successfully',
    type: CustomerListResponseDto,
  })
  async getAtRiskCustomers(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ): Promise<CustomerListResponseDto> {
    this.logger.debug(`Getting at-risk customers for tenant ${user.tenantId}`);

    try {
      const query: CustomerQueryDto = {
        isAtRisk: true,
        limit: limit || 20,
        sortBy: 'churnProbability' as any,
        sortOrder: 'DESC' as any,
        includeAnalytics: true,
      };

      return await this.customersService.findAll(user.tenantId, query);
    } catch (error) {
      this.logger.error(
        `Failed to get at-risk customers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get customer by ID',
    description: 'Retrieve detailed customer information by ID',
  })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer retrieved successfully',
    type: CustomerDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async findOne(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerDetailResponseDto> {
    this.logger.debug(`Finding customer ${id} for tenant ${user.tenantId}`);

    try {
      return await this.customersService.findOne(user.tenantId, id);
    } catch (error) {
      this.logger.error(
        `Failed to find customer ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('number/:customerNumber')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get customer by customer number',
    description: 'Retrieve customer information by customer number',
  })
  @ApiParam({ name: 'customerNumber', description: 'Customer number' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer retrieved successfully',
    type: CustomerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async findByCustomerNumber(
    @CurrentUser() user: any,
    @Param('customerNumber') customerNumber: string,
  ): Promise<CustomerResponseDto> {
    this.logger.debug(
      `Finding customer by number ${customerNumber} for tenant ${user.tenantId}`,
    );

    try {
      return await this.customersService.findByCustomerNumber(
        user.tenantId,
        customerNumber,
      );
    } catch (error) {
      this.logger.error(
        `Failed to find customer by number ${customerNumber}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get(':id/analytics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer analytics',
    description: 'Get detailed analytics for a specific customer',
  })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer analytics retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async getCustomerAnalytics(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.logger.debug(
      `Getting analytics for customer ${id} for tenant ${user.tenantId}`,
    );

    try {
      const analytics = await this.customersService.getCustomerAnalytics(
        user.tenantId,
        id,
      );

      return {
        success: true,
        data: analytics,
        meta: {
          customerId: id,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get customer analytics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Update customer',
    description: 'Update customer information',
  })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer updated successfully',
    type: CustomerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid customer data',
  })
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    this.logger.log(`Updating customer ${id} for tenant ${user.tenantId}`);

    try {
      return await this.customersService.update(
        user.tenantId,
        id,
        updateCustomerDto,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update customer ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete customer',
    description: 'Soft delete customer (mark as inactive)',
  })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Customer deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async remove(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.log(`Deleting customer ${id} for tenant ${user.tenantId}`);

    try {
      await this.customersService.remove(user.tenantId, id);
    } catch (error) {
      this.logger.error(
        `Failed to delete customer ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post(':id/reactivate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Reactivate customer',
    description: 'Reactivate an inactive customer',
  })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer reactivated successfully',
    type: CustomerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async reactivate(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerResponseDto> {
    this.logger.log(`Reactivating customer ${id} for tenant ${user.tenantId}`);

    try {
      const updateDto: UpdateCustomerDto = {
        status: 'active' as any,
      };

      return await this.customersService.update(user.tenantId, id, updateDto);
    } catch (error) {
      this.logger.error(
        `Failed to reactivate customer ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('bulk/import')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Bulk import customers',
    description: 'Import multiple customers at once',
  })
  @ApiBody({
    type: [CreateCustomerDto],
    description: 'Array of customer data to import',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Customers imported successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid import data',
  })
  async bulkImport(
    @CurrentUser() user: any,
    @Body() customers: CreateCustomerDto[],
  ) {
    this.logger.log(
      `Bulk importing ${customers.length} customers for tenant ${user.tenantId}`,
    );

    try {
      const results = [];
      const errors = [];

      for (let i = 0; i < customers.length; i++) {
        try {
          const customer = await this.customersService.create(
            user.tenantId,
            customers[i],
          );
          results.push({ index: i, success: true, customer });
        } catch (error) {
          errors.push({
            index: i,
            success: false,
            error: error.message,
            customerData: customers[i],
          });
        }
      }

      return {
        success: true,
        data: {
          imported: results.length,
          failed: errors.length,
          total: customers.length,
          results,
          errors,
        },
        meta: {
          importedAt: new Date().toISOString(),
          tenantId: user.tenantId,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to bulk import customers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('export/csv')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Export customers to CSV',
    description: 'Export customer data to CSV format',
  })
  @ApiQuery({
    name: 'includeAnalytics',
    required: false,
    description: 'Include analytics data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer data exported successfully',
  })
  async exportToCSV(
    @CurrentUser() user: any,
    @Query('includeAnalytics') includeAnalytics?: boolean,
  ) {
    this.logger.debug(`Exporting customers to CSV for tenant ${user.tenantId}`);

    try {
      const query: CustomerQueryDto = {
        limit: 10000, // Large limit for export
        includeAnalytics: includeAnalytics || false,
      };

      const result = await this.customersService.findAll(user.tenantId, query);

      return {
        success: true,
        data: result.data,
        meta: {
          total: result.meta.total,
          exportedAt: new Date().toISOString(),
          format: 'csv',
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to export customers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
