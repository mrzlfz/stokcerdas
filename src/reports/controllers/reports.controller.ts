import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Res,
  Headers,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { ProductStatus } from '../../products/entities/product.entity';

import { ReportGenerationService } from '../services/report-generation.service';
import { ReportExportService } from '../services/report-export.service';

import {
  InventoryValuationQueryDto,
  StockMovementQueryDto,
  LowStockQueryDto,
  ProductPerformanceQueryDto,
  ReportFormat,
} from '../dto/report-query.dto';

import {
  EmailReportRequestDto,
  EmailReportResponseDto,
  EmailReportType,
} from '../dto/email-report.dto';

import {
  InventoryValuationResponseDto,
  StockMovementResponseDto,
  LowStockResponseDto,
  ProductPerformanceResponseDto,
} from '../dto/report-response.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    private readonly reportGenerationService: ReportGenerationService,
    private readonly reportExportService: ReportExportService,
  ) {}

  @Get('inventory-valuation')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Inventory Valuation Report',
    description: 'Generate a detailed report showing current inventory values, costs, and potential profits',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory valuation report generated successfully',
    type: InventoryValuationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async getInventoryValuationReport(
    @GetTenant() tenantId: string,
    @Query() query: InventoryValuationQueryDto,
    @Res() res?: Response,
    @Headers('user-email') userEmail?: string,
  ): Promise<InventoryValuationResponseDto | void> {
    this.validateDateRange(query.startDate, query.endDate);

    // Generate the report data
    const reportData = await this.reportGenerationService.generateInventoryValuationReport(tenantId, query);

    // If JSON format or no format specified, return JSON
    if (!query.format || query.format === ReportFormat.JSON) {
      return reportData;
    }

    // Handle export formats
    try {
      const exportOptions = {
        format: query.format,
        filename: `inventory-valuation-${new Date().toISOString().split('T')[0]}`,
        email: userEmail,
        tenantName: 'StokCerdas',
      };

      const exportedData = await this.reportExportService.exportInventoryValuationReport(reportData, exportOptions);
      
      if (Buffer.isBuffer(exportedData)) {
        this.sendFileResponse(res, exportedData, exportOptions.filename, query.format);
      } else {
        this.sendTextResponse(res, exportedData, exportOptions.filename, query.format);
      }
    } catch (error) {
      throw new BadRequestException(`Export failed: ${error.message}`);
    }
  }

  @Get('stock-movement')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Stock Movement Report',
    description: 'Generate a detailed report showing all inventory transactions and movements',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock movement report generated successfully',
    type: StockMovementResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for the report period (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for the report period (YYYY-MM-DD)',
    example: '2025-06-30',
  })
  @ApiQuery({
    name: 'movementType',
    required: false,
    description: 'Filter by movement type (all, receipts, issues, transfers, adjustments)',
    example: 'all',
  })
  @ApiQuery({
    name: 'locationIds',
    required: false,
    description: 'Filter by location IDs (comma-separated)',
  })
  @ApiQuery({
    name: 'productIds',
    required: false,
    description: 'Filter by product IDs (comma-separated)',
  })
  async getStockMovementReport(
    @GetTenant() tenantId: string,
    @Query() query: StockMovementQueryDto,
    @Res() res?: Response,
    @Headers('user-email') userEmail?: string,
  ): Promise<StockMovementResponseDto | void> {
    this.validateDateRange(query.startDate, query.endDate);

    // Generate the report data
    const reportData = await this.reportGenerationService.generateStockMovementReport(tenantId, query);

    // If JSON format or no format specified, return JSON
    if (!query.format || query.format === ReportFormat.JSON) {
      return reportData;
    }

    // Handle export formats
    try {
      const exportOptions = {
        format: query.format,
        filename: `stock-movement-${new Date().toISOString().split('T')[0]}`,
        email: userEmail,
        tenantName: 'StokCerdas',
      };

      const exportedData = await this.reportExportService.exportStockMovementReport(reportData, exportOptions);
      
      if (Buffer.isBuffer(exportedData)) {
        this.sendFileResponse(res, exportedData, exportOptions.filename, query.format);
      } else {
        this.sendTextResponse(res, exportedData, exportOptions.filename, query.format);
      }
    } catch (error) {
      throw new BadRequestException(`Export failed: ${error.message}`);
    }
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Low Stock Report',
    description: 'Generate a report showing products with low stock levels that need attention',
  })
  @ApiResponse({
    status: 200,
    description: 'Low stock report generated successfully',
    type: LowStockResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiQuery({
    name: 'includeOutOfStock',
    required: false,
    description: 'Include products that are completely out of stock',
    example: true,
  })
  @ApiQuery({
    name: 'includeReorderNeeded',
    required: false,
    description: 'Include products that have reached their reorder point',
    example: true,
  })
  @ApiQuery({
    name: 'locationIds',
    required: false,
    description: 'Filter by location IDs (comma-separated)',
  })
  @ApiQuery({
    name: 'categoryIds',
    required: false,
    description: 'Filter by category IDs (comma-separated)',
  })
  async getLowStockReport(
    @GetTenant() tenantId: string,
    @Query() query: LowStockQueryDto,
    @Res() res?: Response,
    @Headers('user-email') userEmail?: string,
  ): Promise<LowStockResponseDto | void> {
    // Generate the report data
    const reportData = await this.reportGenerationService.generateLowStockReport(tenantId, query);

    // If JSON format or no format specified, return JSON
    if (!query.format || query.format === ReportFormat.JSON) {
      return reportData;
    }

    // Handle export formats
    try {
      const exportOptions = {
        format: query.format,
        filename: `low-stock-${new Date().toISOString().split('T')[0]}`,
        email: userEmail,
        tenantName: 'StokCerdas',
      };

      const exportedData = await this.reportExportService.exportLowStockReport(reportData, exportOptions);
      
      if (Buffer.isBuffer(exportedData)) {
        this.sendFileResponse(res, exportedData, exportOptions.filename, query.format);
      } else {
        this.sendTextResponse(res, exportedData, exportOptions.filename, query.format);
      }
    } catch (error) {
      throw new BadRequestException(`Export failed: ${error.message}`);
    }
  }

  @Get('product-performance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Product Performance Report',
    description: 'Generate a comprehensive report analyzing product sales performance, profitability, and inventory turnover',
  })
  @ApiResponse({
    status: 200,
    description: 'Product performance report generated successfully',
    type: ProductPerformanceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (admin/manager only)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for the analysis period (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for the analysis period (YYYY-MM-DD)',
    example: '2025-06-30',
  })
  @ApiQuery({
    name: 'minTransactions',
    required: false,
    description: 'Minimum number of transactions to include product in report',
    example: 1,
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include inactive products in the analysis',
    example: false,
  })
  @ApiQuery({
    name: 'categoryIds',
    required: false,
    description: 'Filter by category IDs (comma-separated)',
  })
  async getProductPerformanceReport(
    @GetTenant() tenantId: string,
    @Query() query: ProductPerformanceQueryDto,
    @Res() res?: Response,
    @Headers('user-email') userEmail?: string,
  ): Promise<ProductPerformanceResponseDto | void> {
    this.validateDateRange(query.startDate, query.endDate);

    // Validate analysis period is not too short for meaningful performance data
    if (query.startDate && query.endDate) {
      const startDate = new Date(query.startDate);
      const endDate = new Date(query.endDate);
      const daysDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDifference < 7) {
        throw new BadRequestException('Analysis period must be at least 7 days for meaningful performance data');
      }
    }

    // Generate the report data
    const reportData = await this.reportGenerationService.generateProductPerformanceReport(tenantId, query);

    // If JSON format or no format specified, return JSON
    if (!query.format || query.format === ReportFormat.JSON) {
      return reportData;
    }

    // Handle export formats
    try {
      const exportOptions = {
        format: query.format,
        filename: `product-performance-${new Date().toISOString().split('T')[0]}`,
        email: userEmail,
        tenantName: 'StokCerdas',
      };

      const exportedData = await this.reportExportService.exportProductPerformanceReport(reportData, exportOptions);
      
      if (Buffer.isBuffer(exportedData)) {
        this.sendFileResponse(res, exportedData, exportOptions.filename, query.format);
      } else {
        this.sendTextResponse(res, exportedData, exportOptions.filename, query.format);
      }
    } catch (error) {
      throw new BadRequestException(`Export failed: ${error.message}`);
    }
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Reports Summary',
    description: 'Get a quick summary of all available reports and key metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Reports summary retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (admin/manager only)',
  })
  async getReportsSummary(
    @GetTenant() tenantId: string,
  ): Promise<{
    lastGenerated: string;
    availableReports: string[];
    quickStats: {
      totalProducts: number;
      lowStockItems: number;
      totalInventoryValue: number;
      lastWeekMovements: number;
    };
  }> {
    // Get quick stats for dashboard
    const [
      totalProducts,
      lowStockCount,
      inventoryValue,
      recentMovements,
    ] = await Promise.all([
      this.reportGenerationService['productRepository'].count({
        where: { tenantId, status: ProductStatus.ACTIVE, isDeleted: false },
      }),
      this.reportGenerationService['inventoryItemRepository'].count({
        where: { tenantId, isActive: true },
      }),
      this.reportGenerationService['inventoryItemRepository']
        .createQueryBuilder('item')
        .select('SUM(item.totalValue)', 'total')
        .where('item.tenantId = :tenantId', { tenantId })
        .andWhere('item.isActive = true')
        .getRawOne(),
      this.reportGenerationService['transactionRepository'].count({
        where: {
          tenantId,
          transactionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      }),
    ]);

    return {
      lastGenerated: new Date().toISOString(),
      availableReports: [
        'inventory-valuation',
        'stock-movement',
        'low-stock',
        'product-performance',
      ],
      quickStats: {
        totalProducts,
        lowStockItems: lowStockCount,
        totalInventoryValue: Number(inventoryValue?.total || 0),
        lastWeekMovements: recentMovements,
      },
    };
  }

  @Post('email')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send Report via Email',
    description: 'Generate and send a report to the specified email address',
  })
  @ApiResponse({
    status: 200,
    description: 'Report sent successfully via email',
    type: EmailReportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters or email sending failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async sendReportByEmail(
    @GetTenant() tenantId: string,
    @Body() emailRequest: EmailReportRequestDto,
  ): Promise<EmailReportResponseDto> {
    try {
      // Parse query parameters if provided
      let queryParams = {};
      if (emailRequest.queryParams) {
        try {
          queryParams = JSON.parse(emailRequest.queryParams);
        } catch (error) {
          throw new BadRequestException('Invalid query parameters JSON format');
        }
      }

      // Generate report data based on type
      let reportData: any;
      let reportTypeName: string;

      switch (emailRequest.reportType) {
        case EmailReportType.INVENTORY_VALUATION:
          reportData = await this.reportGenerationService.generateInventoryValuationReport(
            tenantId,
            { ...queryParams, format: emailRequest.format } as InventoryValuationQueryDto,
          );
          reportTypeName = 'Laporan Valuasi Inventori';
          break;

        case EmailReportType.STOCK_MOVEMENT:
          reportData = await this.reportGenerationService.generateStockMovementReport(
            tenantId,
            { ...queryParams, format: emailRequest.format } as StockMovementQueryDto,
          );
          reportTypeName = 'Laporan Pergerakan Stok';
          break;

        case EmailReportType.LOW_STOCK:
          reportData = await this.reportGenerationService.generateLowStockReport(
            tenantId,
            { ...queryParams, format: emailRequest.format } as LowStockQueryDto,
          );
          reportTypeName = 'Laporan Stok Rendah';
          break;

        case EmailReportType.PRODUCT_PERFORMANCE:
          reportData = await this.reportGenerationService.generateProductPerformanceReport(
            tenantId,
            { ...queryParams, format: emailRequest.format } as ProductPerformanceQueryDto,
          );
          reportTypeName = 'Laporan Performa Produk';
          break;

        default:
          throw new BadRequestException('Unsupported report type');
      }

      // Create export options
      const exportOptions = {
        format: emailRequest.format,
        filename: emailRequest.filename || `${emailRequest.reportType}-${new Date().toISOString().split('T')[0]}`,
        email: emailRequest.email,
        subject: emailRequest.subject || `${reportTypeName} - StokCerdas`,
        tenantName: 'StokCerdas',
      };

      // Generate export based on report type
      let exportedData: Buffer | string;
      switch (emailRequest.reportType) {
        case EmailReportType.INVENTORY_VALUATION:
          exportedData = await this.reportExportService.exportInventoryValuationReport(reportData, exportOptions);
          break;
        case EmailReportType.STOCK_MOVEMENT:
          exportedData = await this.reportExportService.exportStockMovementReport(reportData, exportOptions);
          break;
        case EmailReportType.LOW_STOCK:
          exportedData = await this.reportExportService.exportLowStockReport(reportData, exportOptions);
          break;
        case EmailReportType.PRODUCT_PERFORMANCE:
          exportedData = await this.reportExportService.exportProductPerformanceReport(reportData, exportOptions);
          break;
      }

      // Convert to buffer if it's a string
      const reportBuffer = Buffer.isBuffer(exportedData) 
        ? exportedData 
        : Buffer.from(exportedData, 'utf8');

      // Send email
      const emailSent = await this.reportExportService.sendReportByEmail(
        reportBuffer,
        exportOptions,
        reportTypeName,
      );

      if (!emailSent) {
        throw new BadRequestException('Failed to send email');
      }

      return {
        success: true,
        message: `Report sent successfully to ${emailRequest.email}`,
        sentTo: emailRequest.email,
        reportType: emailRequest.reportType,
        format: emailRequest.format.toUpperCase(),
        sentAt: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`Email report error: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to send report: ${error.message}`);
    }
  }

  // Helper methods

  private validateDateRange(startDate?: string, endDate?: string): void {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        throw new BadRequestException('Start date must be before end date');
      }
      
      // Prevent very large date ranges that could impact performance
      const maxDays = 365; // 1 year maximum
      const daysDifference = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDifference > maxDays) {
        throw new BadRequestException(`Date range cannot exceed ${maxDays} days`);
      }
    }

    if (startDate) {
      const start = new Date(startDate);
      if (start > new Date()) {
        throw new BadRequestException('Start date cannot be in the future');
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (end > new Date()) {
        throw new BadRequestException('End date cannot be in the future');
      }
    }
  }

  private sendFileResponse(
    res: Response,
    fileBuffer: Buffer,
    filename: string,
    format: ReportFormat,
  ): void {
    const contentType = this.getContentType(format);
    const fileExtension = this.getFileExtension(format);
    
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}.${fileExtension}"`,
      'Content-Length': fileBuffer.length.toString(),
    });
    
    res.send(fileBuffer);
  }

  private sendTextResponse(
    res: Response,
    content: string,
    filename: string,
    format: ReportFormat,
  ): void {
    const contentType = this.getContentType(format);
    const fileExtension = this.getFileExtension(format);
    
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}.${fileExtension}"`,
      'Content-Length': Buffer.byteLength(content, 'utf8').toString(),
    });
    
    res.send(content);
  }

  private getContentType(format: ReportFormat): string {
    switch (format) {
      case ReportFormat.CSV: return 'text/csv';
      case ReportFormat.EXCEL: return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case ReportFormat.PDF: return 'application/pdf';
      default: return 'application/json';
    }
  }

  private getFileExtension(format: ReportFormat): string {
    switch (format) {
      case ReportFormat.CSV: return 'csv';
      case ReportFormat.EXCEL: return 'xlsx';
      case ReportFormat.PDF: return 'pdf';
      default: return 'json';
    }
  }
}