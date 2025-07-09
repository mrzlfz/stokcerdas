import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
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

import {
  CustomerDataMigrationService,
  MigrationResult,
} from '../services/customer-data-migration.service';

class MigrationConfigDto {
  batchSize?: number = 100;
  dryRun?: boolean = false;
  includeInactive?: boolean = false;
}

@ApiTags('Customer Migration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('customers/migration')
export class CustomerMigrationController {
  private readonly logger = new Logger(CustomerMigrationController.name);

  constructor(
    private readonly migrationService: CustomerDataMigrationService,
  ) {}

  @Post('start')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start customer data migration',
    description:
      'Migrate customer data from orders to dedicated customer entities',
  })
  @ApiBody({ type: MigrationConfigDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Migration started successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid migration configuration',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only administrators can start migrations',
  })
  async startMigration(
    @CurrentUser() user: any,
    @Body() config: MigrationConfigDto = {},
  ): Promise<MigrationResult> {
    this.logger.log(
      `Starting customer migration for tenant ${user.tenantId} by user ${user.userId}`,
    );

    try {
      const batchSize = config.batchSize || 100;

      if (batchSize < 10 || batchSize > 1000) {
        throw new Error('Batch size must be between 10 and 1000');
      }

      const result = await this.migrationService.migrateAllCustomerData(
        user.tenantId,
        batchSize,
      );

      if (result.success) {
        this.logger.log(
          `Migration completed successfully for tenant ${user.tenantId}. ` +
            `Customers created: ${result.summary.customersCreated}, ` +
            `Transactions created: ${result.summary.transactionsCreated}`,
        );
      } else {
        this.logger.error(
          `Migration failed for tenant ${user.tenantId}. ` +
            `Errors: ${result.progress.errors}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Migration failed for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('progress')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get migration progress',
    description: 'Get current status and progress of customer data migration',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Migration progress retrieved successfully',
  })
  async getMigrationProgress(@CurrentUser() user: any) {
    this.logger.debug(`Getting migration progress for tenant ${user.tenantId}`);

    try {
      const progress = await this.migrationService.getMigrationProgress(
        user.tenantId,
      );

      return {
        success: true,
        data: progress,
        meta: {
          tenantId: user.tenantId,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get migration progress for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get migration status summary',
    description: 'Get detailed migration status and statistics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Migration status retrieved successfully',
  })
  async getMigrationStatus(@CurrentUser() user: any) {
    this.logger.debug(`Getting migration status for tenant ${user.tenantId}`);

    try {
      const progress = await this.migrationService.getMigrationProgress(
        user.tenantId,
      );

      const status = {
        migrationCompleted: progress.migrationCompleteness >= 100,
        migrationCompleteness: progress.migrationCompleteness,
        totalOrders: progress.totalOrders,
        totalCustomers: progress.totalCustomers,
        totalTransactions: progress.totalTransactions,
        ordersWithCustomerRef: progress.ordersWithCustomerRef,
        migrationHealth: this.calculateMigrationHealth(progress),
        recommendations: this.generateRecommendations(progress),
      };

      return {
        success: true,
        data: status,
        meta: {
          tenantId: user.tenantId,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get migration status for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('validate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate migration readiness',
    description: 'Check if the system is ready for customer data migration',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Migration validation completed',
  })
  async validateMigration(@CurrentUser() user: any) {
    this.logger.debug(
      `Validating migration readiness for tenant ${user.tenantId}`,
    );

    try {
      const progress = await this.migrationService.getMigrationProgress(
        user.tenantId,
      );

      const validationResults = {
        hasOrders: progress.totalOrders > 0,
        hasCustomerData: progress.totalCustomers > 0,
        migrationNeeded: progress.migrationCompleteness < 100,
        dataIntegrityIssues: [],
        recommendations: [],
      };

      // Check for data integrity issues
      if (progress.totalOrders > 0 && progress.totalCustomers === 0) {
        validationResults.dataIntegrityIssues.push(
          'No customers found but orders exist - migration needed',
        );
        validationResults.recommendations.push(
          'Run customer data migration to create customer entities',
        );
      }

      if (progress.totalCustomers > 0 && progress.totalTransactions === 0) {
        validationResults.dataIntegrityIssues.push(
          'Customers exist but no transactions found',
        );
        validationResults.recommendations.push(
          'Re-run migration to create customer transactions',
        );
      }

      if (
        progress.migrationCompleteness < 100 &&
        progress.migrationCompleteness > 0
      ) {
        validationResults.dataIntegrityIssues.push(
          'Partial migration detected',
        );
        validationResults.recommendations.push(
          'Complete the migration or perform rollback and re-run',
        );
      }

      return {
        success: true,
        data: validationResults,
        meta: {
          tenantId: user.tenantId,
          validatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Migration validation failed for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Delete('rollback')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rollback customer migration',
    description:
      'Rollback customer data migration (WARNING: This will delete all customer data)',
  })
  @ApiQuery({
    name: 'confirm',
    required: true,
    description: 'Must be set to "true" to confirm rollback',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Migration rollback completed',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Rollback confirmation not provided',
  })
  async rollbackMigration(
    @CurrentUser() user: any,
    @Query('confirm') confirm: string,
  ) {
    if (confirm !== 'true') {
      throw new Error(
        'Rollback confirmation required. Add ?confirm=true to proceed.',
      );
    }

    this.logger.warn(
      `Rolling back customer migration for tenant ${user.tenantId} by user ${user.userId}`,
    );

    try {
      const result = await this.migrationService.rollbackMigration(
        user.tenantId,
      );

      this.logger.log(
        `Migration rollback result for tenant ${user.tenantId}: ${result.message}`,
      );

      return {
        success: result.success,
        message: result.message,
        meta: {
          tenantId: user.tenantId,
          rolledBackBy: user.userId,
          rolledBackAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Migration rollback failed for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer data health report',
    description:
      'Get comprehensive health report of customer data and migration status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Health report generated successfully',
  })
  async getDataHealthReport(@CurrentUser() user: any) {
    this.logger.debug(
      `Generating customer data health report for tenant ${user.tenantId}`,
    );

    try {
      const progress = await this.migrationService.getMigrationProgress(
        user.tenantId,
      );

      const healthReport = {
        overall: this.calculateMigrationHealth(progress),
        dataConsistency: {
          orderToCustomerRatio:
            progress.totalOrders > 0
              ? progress.totalCustomers / progress.totalOrders
              : 0,
          customerToTransactionRatio:
            progress.totalCustomers > 0
              ? progress.totalTransactions / progress.totalCustomers
              : 0,
          orderCoveragePercentage: progress.migrationCompleteness,
        },
        statistics: {
          totalOrders: progress.totalOrders,
          totalCustomers: progress.totalCustomers,
          totalTransactions: progress.totalTransactions,
          ordersWithCustomerRef: progress.ordersWithCustomerRef,
        },
        quality: {
          duplicateCustomersLikely:
            progress.totalCustomers > progress.totalOrders * 0.7,
          missingTransactions:
            progress.totalTransactions < progress.totalOrders * 0.8,
          dataIntegrityScore: this.calculateDataIntegrityScore(progress),
        },
        recommendations: this.generateDetailedRecommendations(progress),
      };

      return {
        success: true,
        data: healthReport,
        meta: {
          tenantId: user.tenantId,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate health report for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Private helper methods

  private calculateMigrationHealth(
    progress: any,
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    const completeness = progress.migrationCompleteness;

    if (completeness >= 95) return 'excellent';
    if (completeness >= 80) return 'good';
    if (completeness >= 50) return 'fair';
    return 'poor';
  }

  private generateRecommendations(progress: any): string[] {
    const recommendations = [];

    if (progress.migrationCompleteness === 0) {
      recommendations.push(
        'Start customer data migration to enable advanced analytics',
      );
    } else if (progress.migrationCompleteness < 100) {
      recommendations.push('Complete the customer data migration');
    }

    if (progress.totalCustomers > 0 && progress.totalTransactions === 0) {
      recommendations.push('Create customer transactions from order history');
    }

    if (progress.totalOrders > 0 && progress.totalCustomers === 0) {
      recommendations.push('Extract customer data from existing orders');
    }

    return recommendations;
  }

  private generateDetailedRecommendations(progress: any): string[] {
    const recommendations = this.generateRecommendations(progress);

    // Add performance recommendations
    if (progress.totalCustomers > 10000) {
      recommendations.push(
        'Consider implementing customer data archiving for improved performance',
      );
    }

    if (progress.totalTransactions > 50000) {
      recommendations.push(
        'Implement transaction data partitioning by date for better query performance',
      );
    }

    // Add data quality recommendations
    const customerToOrderRatio =
      progress.totalOrders > 0
        ? progress.totalCustomers / progress.totalOrders
        : 0;
    if (customerToOrderRatio > 0.8) {
      recommendations.push(
        'High customer-to-order ratio detected - review for potential duplicate customers',
      );
    } else if (customerToOrderRatio < 0.3) {
      recommendations.push(
        'Low customer-to-order ratio - customers may be making multiple purchases (good loyalty)',
      );
    }

    return recommendations;
  }

  private calculateDataIntegrityScore(progress: any): number {
    let score = 0;
    let maxScore = 0;

    // Migration completeness (40 points)
    score += (progress.migrationCompleteness / 100) * 40;
    maxScore += 40;

    // Customer-transaction consistency (30 points)
    if (progress.totalCustomers > 0) {
      const transactionRatio =
        Math.min(progress.totalTransactions / progress.totalCustomers, 5) / 5;
      score += transactionRatio * 30;
    }
    maxScore += 30;

    // Order coverage (30 points)
    if (progress.totalOrders > 0) {
      const coverageRatio =
        progress.ordersWithCustomerRef / progress.totalOrders;
      score += coverageRatio * 30;
    }
    maxScore += 30;

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }
}
