import {
  Controller,
  Get,
  Post,
  Put,
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
  IsUUID,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Services
import { OrderRoutingService } from '../services/order-routing.service';
import { OrderFulfillmentService } from '../services/order-fulfillment.service';

// DTOs
export class CreateRoutingRuleDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  priority: number;

  @IsOptional()
  @IsObject()
  conditions?: {
    channelIds?: string[];
    orderValue?: { min?: number; max?: number };
    customerTier?: string[];
    productCategories?: string[];
    shippingLocation?: {
      cities?: string[];
      states?: string[];
      postalCodes?: string[];
    };
    timeConstraints?: {
      dayOfWeek?: number[];
      hourRange?: { start: number; end: number };
    };
  };

  @IsObject()
  actions: {
    assignToLocation?: string;
    setPriority?: number;
    addTags?: string[];
    notifyUsers?: string[];
    holdForReview?: boolean;
    autoApprove?: boolean;
  };
}

export class UpdateRoutingRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsObject()
  conditions?: any;

  @IsOptional()
  @IsObject()
  actions?: any;
}

export class ResolveConflictDto {
  @IsEnum(['use_source', 'use_target', 'manual_override', 'split_fulfillment'])
  action: 'use_source' | 'use_target' | 'manual_override' | 'split_fulfillment';

  @IsOptional()
  @IsObject()
  data?: any;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkRoutingDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  orderIds: string[];

  @IsOptional()
  @IsBoolean()
  forceReRoute?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applyRules?: string[];

  @IsOptional()
  @IsUUID()
  overrideLocation?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  priority?: number;
}

export class RoutingPreferencesDto {
  @IsOptional()
  @IsEnum(['cost', 'speed', 'balanced', 'custom'])
  defaultStrategy?: 'cost' | 'speed' | 'balanced' | 'custom';

  @IsOptional()
  @IsBoolean()
  autoRouting?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  preferredLocations?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  costWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  speedWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityWeight?: number;

  @IsOptional()
  @IsObject()
  customRules?: any;
}

export class LocationPerformanceDto {
  @IsOptional()
  @IsString()
  period?: 'day' | 'week' | 'month' | 'quarter';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @IsOptional()
  @IsBoolean()
  includeComparison?: boolean;
}

@ApiTags('Order Routing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('order-routing')
export class OrderRoutingController {
  private readonly logger = new Logger(OrderRoutingController.name);

  constructor(
    private readonly routingService: OrderRoutingService,
    private readonly fulfillmentService: OrderFulfillmentService,
  ) {}

  // ==================== ROUTING RULES MANAGEMENT ====================

  @Get('rules')
  @ApiOperation({ summary: 'Get all routing rules' })
  @ApiResponse({ status: 200, description: 'Routing rules retrieved successfully' })
  @ApiQuery({ name: 'isActive', type: 'boolean', required: false })
  @ApiQuery({ name: 'priority', type: 'number', required: false })
  @Roles('admin', 'manager')
  async getRoutingRules(
    @CurrentUser() user: any,
    @Query() query: { isActive?: boolean; priority?: number },
  ) {
    try {
      // In a real implementation, this would fetch from database
      const rules = [
        {
          id: 'rule-1',
          name: 'High Value Express',
          description: 'Route high-value orders to express processing',
          isActive: true,
          priority: 1,
          conditions: { orderValue: { min: 1000000 } },
          actions: { setPriority: 1, addTags: ['high-value', 'express'] },
          createdAt: new Date(),
          appliedCount: 150,
          successRate: 98.5,
        },
        {
          id: 'rule-2',
          name: 'Same City Fast',
          description: 'Route same-city orders to nearby locations',
          isActive: true,
          priority: 2,
          conditions: { shippingLocation: { cities: ['Jakarta', 'Surabaya'] } },
          actions: { setPriority: 2, addTags: ['same-city'] },
          createdAt: new Date(),
          appliedCount: 320,
          successRate: 95.2,
        },
      ];

      // Apply filters
      let filteredRules = rules;
      if (query.isActive !== undefined) {
        filteredRules = filteredRules.filter(rule => rule.isActive === query.isActive);
      }
      if (query.priority !== undefined) {
        filteredRules = filteredRules.filter(rule => rule.priority === query.priority);
      }

      return {
        success: true,
        data: filteredRules,
        total: filteredRules.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get routing rules: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rules/:ruleId')
  @ApiOperation({ summary: 'Get routing rule by ID' })
  @ApiResponse({ status: 200, description: 'Routing rule retrieved successfully' })
  @ApiParam({ name: 'ruleId', type: 'string' })
  @Roles('admin', 'manager')
  async getRoutingRuleById(
    @CurrentUser() user: any,
    @Param('ruleId') ruleId: string,
  ) {
    try {
      // Mock implementation
      const rule = {
        id: ruleId,
        name: 'High Value Express',
        description: 'Route high-value orders to express processing',
        isActive: true,
        priority: 1,
        conditions: { orderValue: { min: 1000000 } },
        actions: { setPriority: 1, addTags: ['high-value', 'express'] },
        createdAt: new Date(),
        updatedAt: new Date(),
        appliedCount: 150,
        successRate: 98.5,
        recentApplications: [
          { orderId: 'order-1', appliedAt: new Date(), success: true },
          { orderId: 'order-2', appliedAt: new Date(), success: true },
        ],
      };

      return {
        success: true,
        data: rule,
      };
    } catch (error) {
      this.logger.error(`Failed to get routing rule: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create new routing rule' })
  @ApiResponse({ status: 201, description: 'Routing rule created successfully' })
  @Roles('admin', 'manager')
  async createRoutingRule(
    @CurrentUser() user: any,
    @Body() createDto: CreateRoutingRuleDto,
  ) {
    try {
      // Mock implementation - in real app, this would save to database
      const rule = {
        id: `rule-${Date.now()}`,
        ...createDto,
        isActive: true,
        tenantId: user.tenantId,
        createdBy: user.id,
        createdAt: new Date(),
        appliedCount: 0,
        successRate: 0,
      };

      this.logger.log(`Created routing rule: ${rule.name} for tenant ${user.tenantId}`);

      return {
        success: true,
        data: rule,
        message: 'Routing rule created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create routing rule: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('rules/:ruleId')
  @ApiOperation({ summary: 'Update routing rule' })
  @ApiResponse({ status: 200, description: 'Routing rule updated successfully' })
  @ApiParam({ name: 'ruleId', type: 'string' })
  @Roles('admin', 'manager')
  async updateRoutingRule(
    @CurrentUser() user: any,
    @Param('ruleId') ruleId: string,
    @Body() updateDto: UpdateRoutingRuleDto,
  ) {
    try {
      // Mock implementation
      const updatedRule = {
        id: ruleId,
        ...updateDto,
        updatedBy: user.id,
        updatedAt: new Date(),
      };

      this.logger.log(`Updated routing rule: ${ruleId} for tenant ${user.tenantId}`);

      return {
        success: true,
        data: updatedRule,
        message: 'Routing rule updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update routing rule: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('rules/:ruleId/toggle')
  @ApiOperation({ summary: 'Toggle routing rule active status' })
  @ApiResponse({ status: 200, description: 'Routing rule toggled successfully' })
  @ApiParam({ name: 'ruleId', type: 'string' })
  @Roles('admin', 'manager')
  async toggleRoutingRule(
    @CurrentUser() user: any,
    @Param('ruleId') ruleId: string,
  ) {
    try {
      // Mock implementation
      const isActive = Math.random() > 0.5; // Random for demo

      this.logger.log(`Toggled routing rule ${ruleId} to ${isActive ? 'active' : 'inactive'}`);

      return {
        success: true,
        data: { id: ruleId, isActive },
        message: `Routing rule ${isActive ? 'activated' : 'deactivated'} successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to toggle routing rule: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== INTELLIGENT ROUTING ====================

  @Post('intelligent/analyze')
  @ApiOperation({ summary: 'Analyze optimal routing for orders' })
  @ApiResponse({ status: 200, description: 'Routing analysis completed successfully' })
  @ApiBody({
    schema: {
      properties: {
        orderIds: { type: 'array', items: { type: 'string' } },
        analysisType: { type: 'string', enum: ['cost', 'speed', 'balanced', 'custom'] },
        constraints: { type: 'object' },
      },
    },
  })
  @Roles('admin', 'manager')
  async analyzeIntelligentRouting(
    @CurrentUser() user: any,
    @Body() body: {
      orderIds: string[];
      analysisType: 'cost' | 'speed' | 'balanced' | 'custom';
      constraints?: any;
    },
  ) {
    try {
      // Mock intelligent routing analysis
      const analysis = {
        analysisId: `analysis-${Date.now()}`,
        analysisType: body.analysisType,
        orderCount: body.orderIds.length,
        recommendations: body.orderIds.map((orderId, index) => ({
          orderId,
          currentLocation: `location-${index % 3 + 1}`,
          recommendedLocation: `location-${(index + 1) % 3 + 1}`,
          improvement: {
            cost: Math.round((Math.random() * 20 - 10) * 100) / 100, // -10% to +10%
            time: Math.round((Math.random() * 30 - 15) * 100) / 100, // -15% to +15%
            score: Math.round((50 + Math.random() * 50) * 100) / 100, // 50-100
          },
          reasons: ['Better location proximity', 'Lower shipping cost', 'Faster processing'],
        })),
        summary: {
          totalSavings: Math.round(Math.random() * 1000000), // Random IDR savings
          averageTimeImprovement: Math.round((Math.random() * 10) * 100) / 100,
          feasibilityScore: Math.round((70 + Math.random() * 30) * 100) / 100,
        },
        generatedAt: new Date(),
      };

      return {
        success: true,
        data: analysis,
        message: 'Intelligent routing analysis completed',
      };
    } catch (error) {
      this.logger.error(`Failed to analyze intelligent routing: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('intelligent/optimize')
  @ApiOperation({ summary: 'Apply intelligent routing optimization' })
  @ApiResponse({ status: 200, description: 'Routing optimization applied successfully' })
  @Roles('admin', 'manager')
  async applyIntelligentOptimization(
    @CurrentUser() user: any,
    @Body() body: {
      analysisId: string;
      applyRecommendations: string[]; // List of order IDs to apply recommendations to
      dryRun?: boolean;
    },
  ) {
    try {
      const results = [];

      for (const orderId of body.applyRecommendations) {
        try {
          if (!body.dryRun) {
            // Apply actual routing optimization
            const routing = await this.routingService.routeOrder(user.tenantId, orderId, {
              forceReRoute: true,
            });
            
            results.push({
              orderId,
              success: true,
              routing,
            });
          } else {
            // Dry run - just simulate
            results.push({
              orderId,
              success: true,
              simulation: {
                wouldRoute: true,
                estimatedImprovement: {
                  cost: Math.round((Math.random() * 20 - 10) * 100) / 100,
                  time: Math.round((Math.random() * 30 - 15) * 100) / 100,
                },
              },
            });
          }
        } catch (error) {
          results.push({
            orderId,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;

      return {
        success: failedCount === 0,
        data: {
          analysisId: body.analysisId,
          dryRun: body.dryRun || false,
          results,
          summary: {
            totalOrders: body.applyRecommendations.length,
            successCount,
            failedCount,
          },
        },
        message: body.dryRun 
          ? 'Optimization simulation completed'
          : `Optimization applied: ${successCount}/${body.applyRecommendations.length} successful`,
      };
    } catch (error) {
      this.logger.error(`Failed to apply intelligent optimization: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== CONFLICT MANAGEMENT ====================

  @Get('conflicts')
  @ApiOperation({ summary: 'Get all cross-channel conflicts' })
  @ApiResponse({ status: 200, description: 'Conflicts retrieved successfully' })
  @ApiQuery({ name: 'severity', enum: ['low', 'medium', 'high', 'critical'], required: false })
  @ApiQuery({ name: 'type', enum: ['inventory', 'pricing', 'status', 'fulfillment'], required: false })
  @ApiQuery({ name: 'autoResolvable', type: 'boolean', required: false })
  @Roles('admin', 'manager')
  async getConflicts(
    @CurrentUser() user: any,
    @Query() query: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      type?: 'inventory' | 'pricing' | 'status' | 'fulfillment';
      autoResolvable?: boolean;
    },
  ) {
    try {
      const conflicts = await this.routingService.detectCrossChannelConflicts(user.tenantId);

      // Apply filters
      let filteredConflicts = conflicts;
      if (query.severity) {
        filteredConflicts = filteredConflicts.filter(c => c.severity === query.severity);
      }
      if (query.type) {
        filteredConflicts = filteredConflicts.filter(c => c.type === query.type);
      }
      if (query.autoResolvable !== undefined) {
        filteredConflicts = filteredConflicts.filter(c => c.autoResolvable === query.autoResolvable);
      }

      return {
        success: true,
        data: filteredConflicts,
        summary: {
          total: filteredConflicts.length,
          critical: filteredConflicts.filter(c => c.severity === 'critical').length,
          autoResolvable: filteredConflicts.filter(c => c.autoResolvable).length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get conflicts: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('conflicts/:conflictId/resolve')
  @ApiOperation({ summary: 'Resolve cross-channel conflict' })
  @ApiResponse({ status: 200, description: 'Conflict resolved successfully' })
  @ApiParam({ name: 'conflictId', type: 'string' })
  @Roles('admin', 'manager')
  async resolveConflict(
    @CurrentUser() user: any,
    @Param('conflictId') conflictId: string,
    @Body() resolveDto: ResolveConflictDto,
  ) {
    try {
      const resolution = await this.routingService.resolveConflict(user.tenantId, conflictId, {
        ...resolveDto,
        userId: user.id,
      });

      return {
        success: true,
        data: resolution,
        message: 'Conflict resolved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to resolve conflict: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('conflicts/auto-resolve')
  @ApiOperation({ summary: 'Auto-resolve all resolvable conflicts' })
  @ApiResponse({ status: 200, description: 'Auto-resolution completed successfully' })
  @Roles('admin', 'manager')
  async autoResolveConflicts(
    @CurrentUser() user: any,
    @Body() body: { conflictTypes?: string[]; maxSeverity?: string },
  ) {
    try {
      // Mock auto-resolution
      const autoResolved = [
        { conflictId: 'conflict-1', type: 'inventory', resolution: 'use_source', success: true },
        { conflictId: 'conflict-2', type: 'status', resolution: 'use_target', success: true },
        { conflictId: 'conflict-3', type: 'pricing', resolution: 'manual_override', success: false, error: 'Requires manual intervention' },
      ];

      const successCount = autoResolved.filter(r => r.success).length;
      const failedCount = autoResolved.length - successCount;

      return {
        success: failedCount === 0,
        data: {
          resolved: autoResolved,
          summary: {
            totalConflicts: autoResolved.length,
            successCount,
            failedCount,
          },
        },
        message: `Auto-resolution completed: ${successCount}/${autoResolved.length} conflicts resolved`,
      };
    } catch (error) {
      this.logger.error(`Failed to auto-resolve conflicts: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== PERFORMANCE ANALYTICS ====================

  @Get('analytics/performance')
  @ApiOperation({ summary: 'Get routing performance analytics' })
  @ApiResponse({ status: 200, description: 'Performance analytics retrieved successfully' })
  @ApiQuery({ name: 'period', enum: ['day', 'week', 'month', 'quarter'], required: false })
  @ApiQuery({ name: 'metrics', type: 'string', isArray: true, required: false })
  @Roles('admin', 'manager')
  async getPerformanceAnalytics(
    @CurrentUser() user: any,
    @Query() query: LocationPerformanceDto,
  ) {
    try {
      const period = query.period || 'week';
      const metrics = query.metrics || ['routing_time', 'accuracy', 'cost_efficiency'];

      // Mock performance data
      const analytics = {
        period,
        dateRange: {
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          to: new Date(),
        },
        overall: {
          routingAccuracy: 96.8, // percentage
          averageRoutingTime: 2.3, // minutes
          costEfficiency: 87.5, // percentage
          customerSatisfaction: 4.6, // out of 5
        },
        trends: {
          routingTime: [2.1, 2.3, 2.0, 2.5, 2.4, 2.2, 2.3],
          accuracy: [96.2, 96.8, 97.1, 96.5, 96.9, 97.0, 96.8],
          costSavings: [12.3, 15.2, 11.8, 14.6, 13.9, 16.1, 15.8],
        },
        locationPerformance: [
          {
            locationId: 'loc-1',
            locationName: 'Jakarta Warehouse',
            routingScore: 94.2,
            avgProcessingTime: 18.5, // hours
            costEfficiency: 91.3,
            orderCount: 145,
          },
          {
            locationId: 'loc-2',
            locationName: 'Surabaya Distribution',
            routingScore: 88.7,
            avgProcessingTime: 22.1,
            costEfficiency: 85.9,
            orderCount: 98,
          },
        ],
        rulesPerformance: [
          {
            ruleId: 'rule-1',
            ruleName: 'High Value Express',
            applicationsCount: 67,
            successRate: 98.5,
            avgImprovement: 23.4, // percentage
          },
        ],
      };

      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error(`Failed to get performance analytics: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/locations/:locationId/performance')
  @ApiOperation({ summary: 'Get specific location performance' })
  @ApiResponse({ status: 200, description: 'Location performance retrieved successfully' })
  @ApiParam({ name: 'locationId', type: 'string' })
  @Roles('admin', 'manager', 'staff')
  async getLocationPerformance(
    @CurrentUser() user: any,
    @Param('locationId') locationId: string,
    @Query() query: LocationPerformanceDto,
  ) {
    try {
      // Mock location-specific performance data
      const performance = {
        locationId,
        locationName: 'Jakarta Warehouse',
        period: query.period || 'week',
        overview: {
          totalOrders: 245,
          avgProcessingTime: 18.5, // hours
          onTimeDeliveryRate: 94.2, // percentage
          costPerOrder: 45000, // IDR
          capacityUtilization: 78.3, // percentage
        },
        trends: {
          daily: [
            { date: '2024-01-01', orders: 35, processingTime: 17.2, onTimeRate: 95.1 },
            { date: '2024-01-02', orders: 42, processingTime: 19.1, onTimeRate: 93.8 },
            { date: '2024-01-03', orders: 38, processingTime: 16.8, onTimeRate: 96.2 },
          ],
        },
        efficiency: {
          pickingAccuracy: 99.2,
          packingSpeed: 4.8, // orders per hour
          shippingAccuracy: 98.7,
          returnRate: 1.3,
        },
        capacity: {
          maxDailyOrders: 120,
          currentLoad: 94,
          staffCount: 12,
          peakHours: ['09:00-11:00', '14:00-16:00'],
        },
        improvements: [
          {
            category: 'processing_time',
            suggestion: 'Optimize picking routes',
            potentialSaving: '15% time reduction',
          },
          {
            category: 'capacity',
            suggestion: 'Add evening shift',
            potentialSaving: '40% capacity increase',
          },
        ],
      };

      return {
        success: true,
        data: performance,
      };
    } catch (error) {
      this.logger.error(`Failed to get location performance: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== ROUTING PREFERENCES ====================

  @Get('preferences')
  @ApiOperation({ summary: 'Get routing preferences' })
  @ApiResponse({ status: 200, description: 'Routing preferences retrieved successfully' })
  @Roles('admin', 'manager')
  async getRoutingPreferences(
    @CurrentUser() user: any,
  ) {
    try {
      // Mock preferences - in real implementation, fetch from database
      const preferences = {
        defaultStrategy: 'balanced',
        autoRouting: true,
        preferredLocations: ['loc-1', 'loc-2'],
        weights: {
          cost: 30,
          speed: 40,
          quality: 30,
        },
        customRules: {
          highValueThreshold: 1000000,
          expressDeliveryEnabled: true,
          sameDayDeliveryEnabled: false,
        },
        notifications: {
          routingFailures: true,
          conflictDetection: true,
          performanceAlerts: false,
        },
        updatedAt: new Date(),
        updatedBy: user.id,
      };

      return {
        success: true,
        data: preferences,
      };
    } catch (error) {
      this.logger.error(`Failed to get routing preferences: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update routing preferences' })
  @ApiResponse({ status: 200, description: 'Routing preferences updated successfully' })
  @Roles('admin', 'manager')
  async updateRoutingPreferences(
    @CurrentUser() user: any,
    @Body() preferencesDto: RoutingPreferencesDto,
  ) {
    try {
      // Mock update - in real implementation, save to database
      const updatedPreferences = {
        ...preferencesDto,
        updatedAt: new Date(),
        updatedBy: user.id,
      };

      this.logger.log(`Updated routing preferences for tenant ${user.tenantId}`);

      return {
        success: true,
        data: updatedPreferences,
        message: 'Routing preferences updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update routing preferences: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==================== SYSTEM MONITORING ====================

  @Get('health')
  @ApiOperation({ summary: 'Get routing system health status' })
  @ApiResponse({ status: 200, description: 'System health retrieved successfully' })
  @Roles('admin', 'manager')
  async getSystemHealth(
    @CurrentUser() user: any,
  ) {
    try {
      const health = {
        overall: 'healthy', // healthy, degraded, critical
        components: {
          routingEngine: { status: 'healthy', responseTime: 95, uptime: 99.8 },
          conflictDetection: { status: 'healthy', responseTime: 120, uptime: 99.5 },
          ruleEngine: { status: 'healthy', responseTime: 85, uptime: 99.9 },
          analytics: { status: 'degraded', responseTime: 250, uptime: 98.2 },
        },
        metrics: {
          activeRules: 8,
          processingQueue: 23,
          avgRoutingTime: 2.3, // minutes
          conflictsDetected: 2,
          systemLoad: 67.4, // percentage
        },
        alerts: [
          {
            level: 'warning',
            component: 'analytics',
            message: 'Slow response times detected',
            since: new Date(Date.now() - 30 * 60 * 1000),
          },
        ],
        lastUpdated: new Date(),
      };

      return {
        success: true,
        data: health,
      };
    } catch (error) {
      this.logger.error(`Failed to get system health: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('metrics/real-time')
  @ApiOperation({ summary: 'Get real-time routing metrics' })
  @ApiResponse({ status: 200, description: 'Real-time metrics retrieved successfully' })
  @Roles('admin', 'manager')
  async getRealTimeMetrics(
    @CurrentUser() user: any,
  ) {
    try {
      const metrics = {
        timestamp: new Date(),
        routing: {
          ordersInQueue: 15,
          averageProcessingTime: 2.1, // minutes
          successRate: 97.3, // percentage
          throughput: 45, // orders per hour
        },
        fulfillment: {
          activeAssignments: 89,
          locationUtilization: {
            'loc-1': 78.4,
            'loc-2': 65.9,
            'loc-3': 82.1,
          },
          averageFulfillmentTime: 18.7, // hours
        },
        conflicts: {
          activeConflicts: 3,
          autoResolved: 12,
          manualResolved: 4,
          pendingResolution: 1,
        },
        system: {
          cpuUsage: 45.2,
          memoryUsage: 67.8,
          diskUsage: 34.1,
          networkLatency: 12, // ms
        },
      };

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      this.logger.error(`Failed to get real-time metrics: ${error.message}`, error.stack);
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