import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
  ConflictException,
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
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

// DTOs
import {
  CreateReorderRuleDto,
  UpdateReorderRuleDto,
  ReorderRuleQueryDto,
  PauseReorderRuleDto,
  TestReorderRuleDto,
  BulkActionReorderRuleDto,
} from '../dto/reorder-rule.dto';
import {
  CreateAutomationScheduleDto,
  UpdateAutomationScheduleDto,
  AutomationScheduleQueryDto,
  PauseScheduleDto,
  ExecuteScheduleDto,
  BulkScheduleActionDto,
  ScheduleExecutionQueryDto,
} from '../dto/automation-schedule.dto';
import {
  ExecuteAutomatedPurchaseDto,
  ExecuteBulkAutomatedPurchaseDto,
  ProcessAutomationRulesDto,
  AutomatedPurchaseResultDto,
  BulkAutomatedPurchaseResultDto,
  RuleEngineMetricsDto,
} from '../dto/automated-purchasing.dto';

// Services
import { ReorderCalculationService } from '../services/reorder-calculation.service';
import { SupplierSelectionService } from '../services/supplier-selection.service';
import { AutomatedPurchasingService } from '../services/automated-purchasing.service';
import { AutomationRuleEngine } from '../services/automation-rule-engine.service';

// Entities
import { ReorderRule } from '../entities/reorder-rule.entity';
import { AutomationSchedule } from '../entities/automation-schedule.entity';

@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('automation')
export class AutomationController {
  constructor(
    private readonly reorderCalculationService: ReorderCalculationService,
    private readonly supplierSelectionService: SupplierSelectionService,
    private readonly automatedPurchasingService: AutomatedPurchasingService,
    private readonly automationRuleEngine: AutomationRuleEngine,
  ) {}

  // =============================================
  // REORDER RULES MANAGEMENT
  // =============================================

  @Post('reorder-rules')
  @ApiOperation({
    summary: 'Create new reorder rule',
    description: 'Create a new automated reorder rule for a product and location',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Reorder rule created successfully',
    type: ReorderRule,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid reorder rule data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Reorder rule already exists for this product/location',
  })
  @RequirePermissions('automation:reorder-rules:create')
  async createReorderRule(
    @Body() createReorderRuleDto: CreateReorderRuleDto,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<ReorderRule> {
    try {
      return await this.reorderCalculationService.createReorderRule(
        req.user.tenantId,
        createReorderRuleDto,
        user.id,
      );
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw new ConflictException('Reorder rule already exists for this product/location combination');
      }
      throw new BadRequestException(`Failed to create reorder rule: ${error.message}`);
    }
  }

  @Get('reorder-rules')
  @ApiOperation({
    summary: 'Get reorder rules',
    description: 'Retrieve reorder rules with filtering, sorting, and pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reorder rules retrieved successfully',
    type: [ReorderRule],
  })
  @RequirePermissions('automation:reorder-rules:read')
  async getReorderRules(
    @Query() query: ReorderRuleQueryDto,
    @Request() req: any,
  ): Promise<{
    data: ReorderRule[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const rules = await this.reorderCalculationService.findReorderRules(req.user.tenantId, query);
    const total = rules.length; // In a real implementation, this would be a separate count query
    const page = query.page || 1;
    const limit = query.limit || 20;
    
    return {
      data: rules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('reorder-rules/:id')
  @ApiOperation({
    summary: 'Get reorder rule by ID',
    description: 'Retrieve a specific reorder rule with its details and execution history',
  })
  @ApiParam({
    name: 'id',
    description: 'Reorder rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reorder rule retrieved successfully',
    type: ReorderRule,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Reorder rule not found',
  })
  @RequirePermissions('automation:reorder-rules:read')
  async getReorderRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<ReorderRule> {
    const rule = await this.reorderCalculationService.findReorderRuleById(req.user.tenantId, id);
    if (!rule) {
      throw new NotFoundException(`Reorder rule with ID ${id} not found`);
    }
    return rule;
  }

  @Put('reorder-rules/:id')
  @ApiOperation({
    summary: 'Update reorder rule',
    description: 'Update an existing reorder rule configuration',
  })
  @ApiParam({
    name: 'id',
    description: 'Reorder rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reorder rule updated successfully',
    type: ReorderRule,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Reorder rule not found',
  })
  @RequirePermissions('automation:reorder-rules:update')
  async updateReorderRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReorderRuleDto: UpdateReorderRuleDto,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<ReorderRule> {
    try {
      return await this.reorderCalculationService.updateReorderRule(
        req.user.tenantId,
        id,
        updateReorderRuleDto,
        user.id,
      );
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(`Reorder rule with ID ${id} not found`);
      }
      throw new BadRequestException(`Failed to update reorder rule: ${error.message}`);
    }
  }

  @Delete('reorder-rules/:id')
  @ApiOperation({
    summary: 'Delete reorder rule',
    description: 'Soft delete a reorder rule (can be restored)',
  })
  @ApiParam({
    name: 'id',
    description: 'Reorder rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Reorder rule deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Reorder rule not found',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('automation:reorder-rules:delete')
  async deleteReorderRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<void> {
    try {
      await this.reorderCalculationService.deleteReorderRule(req.user.tenantId, id, user.id);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(`Reorder rule with ID ${id} not found`);
      }
      throw new BadRequestException(`Failed to delete reorder rule: ${error.message}`);
    }
  }

  @Patch('reorder-rules/:id/pause')
  @ApiOperation({
    summary: 'Pause reorder rule',
    description: 'Temporarily pause a reorder rule from executing',
  })
  @ApiParam({
    name: 'id',
    description: 'Reorder rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reorder rule paused successfully',
    type: ReorderRule,
  })
  @RequirePermissions('automation:reorder-rules:update')
  async pauseReorderRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() pauseDto: PauseReorderRuleDto,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<ReorderRule> {
    return this.reorderCalculationService.pauseReorderRule(
      req.user.tenantId,
      id,
      pauseDto.reason,
      user.id,
    );
  }

  @Patch('reorder-rules/:id/resume')
  @ApiOperation({
    summary: 'Resume reorder rule',
    description: 'Resume a paused reorder rule',
  })
  @ApiParam({
    name: 'id',
    description: 'Reorder rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reorder rule resumed successfully',
    type: ReorderRule,
  })
  @RequirePermissions('automation:reorder-rules:update')
  async resumeReorderRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<ReorderRule> {
    return this.reorderCalculationService.resumeReorderRule(req.user.tenantId, id, user.id);
  }

  @Post('reorder-rules/:id/test')
  @ApiOperation({
    summary: 'Test reorder rule',
    description: 'Test a reorder rule execution without creating actual purchase order',
  })
  @ApiParam({
    name: 'id',
    description: 'Reorder rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reorder rule test completed',
    type: AutomatedPurchaseResultDto,
  })
  @RequirePermissions('automation:reorder-rules:execute')
  async testReorderRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() testDto: TestReorderRuleDto,
    @Request() req: any,
  ): Promise<AutomatedPurchaseResultDto> {
    return this.automatedPurchasingService.executeAutomatedPurchase({
      reorderRuleId: id,
      tenantId: req.user.tenantId,
      dryRun: true,
      forceExecution: testDto.forceExecution,
      overrides: {
        orderQuantity: testDto.overrideQuantity,
        selectedSupplierId: testDto.overrideSupplierId,
        urgencyLevel: testDto.overrideUrgencyLevel,
      },
    });
  }

  @Post('reorder-rules/bulk-action')
  @ApiOperation({
    summary: 'Bulk action on reorder rules',
    description: 'Perform bulk actions (activate, deactivate, pause, resume, delete, test) on multiple reorder rules',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk action completed successfully',
  })
  @RequirePermissions('automation:reorder-rules:bulk-update')
  async bulkActionReorderRules(
    @Body() bulkActionDto: BulkActionReorderRuleDto,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<{
    success: boolean;
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    return this.reorderCalculationService.bulkActionReorderRules(
      req.user.tenantId,
      bulkActionDto.action,
      bulkActionDto.ruleIds,
      user.id,
    );
  }

  // =============================================
  // AUTOMATION SCHEDULES MANAGEMENT
  // =============================================

  @Post('schedules')
  @ApiOperation({
    summary: 'Create automation schedule',
    description: 'Create a new automation schedule for background processing',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Automation schedule created successfully',
    type: AutomationSchedule,
  })
  @RequirePermissions('automation:schedules:create')
  async createAutomationSchedule(
    @Body() createScheduleDto: CreateAutomationScheduleDto,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<AutomationSchedule> {
    return this.automationRuleEngine.createAutomationSchedule(
      req.user.tenantId,
      createScheduleDto,
      user.id,
    );
  }

  @Get('schedules')
  @ApiOperation({
    summary: 'Get automation schedules',
    description: 'Retrieve automation schedules with filtering and pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation schedules retrieved successfully',
    type: [AutomationSchedule],
  })
  @RequirePermissions('automation:schedules:read')
  async getAutomationSchedules(
    @Query() query: AutomationScheduleQueryDto,
    @Request() req: any,
  ): Promise<{
    data: AutomationSchedule[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const schedules = await this.automationRuleEngine.findAutomationSchedules(req.user.tenantId, query);
    const total = schedules.length;
    const page = query.page || 1;
    const limit = query.limit || 20;
    
    return {
      data: schedules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('schedules/:id')
  @ApiOperation({
    summary: 'Get automation schedule by ID',
    description: 'Retrieve a specific automation schedule with execution history',
  })
  @ApiParam({
    name: 'id',
    description: 'Automation schedule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation schedule retrieved successfully',
    type: AutomationSchedule,
  })
  @RequirePermissions('automation:schedules:read')
  async getAutomationSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<AutomationSchedule> {
    const schedule = await this.automationRuleEngine.findAutomationScheduleById(
      req.user.tenantId,
      id,
    );
    if (!schedule) {
      throw new NotFoundException(`Automation schedule with ID ${id} not found`);
    }
    return schedule;
  }

  @Put('schedules/:id')
  @ApiOperation({
    summary: 'Update automation schedule',
    description: 'Update an existing automation schedule configuration',
  })
  @ApiParam({
    name: 'id',
    description: 'Automation schedule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation schedule updated successfully',
    type: AutomationSchedule,
  })
  @RequirePermissions('automation:schedules:update')
  async updateAutomationSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateAutomationScheduleDto,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<AutomationSchedule> {
    return this.automationRuleEngine.updateAutomationSchedule(
      req.user.tenantId,
      id,
      updateScheduleDto,
      user.id,
    );
  }

  @Delete('schedules/:id')
  @ApiOperation({
    summary: 'Delete automation schedule',
    description: 'Delete an automation schedule and stop its execution',
  })
  @ApiParam({
    name: 'id',
    description: 'Automation schedule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Automation schedule deleted successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('automation:schedules:delete')
  async deleteAutomationSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.automationRuleEngine.deleteAutomationSchedule(req.user.tenantId, id, user.id);
  }

  @Patch('schedules/:id/pause')
  @ApiOperation({
    summary: 'Pause automation schedule',
    description: 'Temporarily pause an automation schedule',
  })
  @ApiParam({
    name: 'id',
    description: 'Automation schedule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation schedule paused successfully',
    type: AutomationSchedule,
  })
  @RequirePermissions('automation:schedules:update')
  async pauseAutomationSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() pauseDto: PauseScheduleDto,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<AutomationSchedule> {
    return this.automationRuleEngine.pauseAutomationSchedule(
      req.user.tenantId,
      id,
      pauseDto.reason,
      user.id,
    );
  }

  @Patch('schedules/:id/resume')
  @ApiOperation({
    summary: 'Resume automation schedule',
    description: 'Resume a paused automation schedule',
  })
  @ApiParam({
    name: 'id',
    description: 'Automation schedule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation schedule resumed successfully',
    type: AutomationSchedule,
  })
  @RequirePermissions('automation:schedules:update')
  async resumeAutomationSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<AutomationSchedule> {
    return this.automationRuleEngine.resumeAutomationSchedule(req.user.tenantId, id, user.id);
  }

  @Post('schedules/:id/execute')
  @ApiOperation({
    summary: 'Execute automation schedule',
    description: 'Manually trigger execution of an automation schedule',
  })
  @ApiParam({
    name: 'id',
    description: 'Automation schedule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation schedule execution started',
  })
  @RequirePermissions('automation:schedules:execute')
  async executeAutomationSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() executeDto: ExecuteScheduleDto,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string; jobId?: string }> {
    return this.automationRuleEngine.executeAutomationSchedule(req.user.tenantId, id, executeDto);
  }

  @Post('schedules/bulk-action')
  @ApiOperation({
    summary: 'Bulk action on automation schedules',
    description: 'Perform bulk actions on multiple automation schedules',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk action completed successfully',
  })
  @RequirePermissions('automation:schedules:bulk-update')
  async bulkActionAutomationSchedules(
    @Body() bulkActionDto: BulkScheduleActionDto,
    @Request() req: any,
    @CurrentUser() user: User,
  ): Promise<{
    success: boolean;
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    return this.automationRuleEngine.bulkActionAutomationSchedules(
      req.user.tenantId,
      bulkActionDto.action,
      bulkActionDto.scheduleIds,
      user.id,
    );
  }

  @Get('schedules/:id/executions')
  @ApiOperation({
    summary: 'Get schedule execution history',
    description: 'Retrieve execution history for an automation schedule',
  })
  @ApiParam({
    name: 'id',
    description: 'Automation schedule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Schedule execution history retrieved successfully',
  })
  @RequirePermissions('automation:schedules:read')
  async getScheduleExecutions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ScheduleExecutionQueryDto,
    @Request() req: any,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const executions = await this.automationRuleEngine.getScheduleExecutions(req.user.tenantId, id, query);
    const total = executions.length;
    const page = query.page || 1;
    const limit = query.limit || 20;
    
    return {
      data: executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // =============================================
  // AUTOMATED PURCHASING EXECUTION
  // =============================================

  @Post('execute/single')
  @ApiOperation({
    summary: 'Execute automated purchase',
    description: 'Execute automated purchasing for a single reorder rule or product',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automated purchase executed successfully',
    type: AutomatedPurchaseResultDto,
  })
  @RequirePermissions('automation:purchasing:execute')
  async executeAutomatedPurchase(
    @Body() executeDto: ExecuteAutomatedPurchaseDto,
    @Request() req: any,
  ): Promise<AutomatedPurchaseResultDto> {
    return this.automatedPurchasingService.executeAutomatedPurchase({
      ...executeDto,
      tenantId: req.user.tenantId,
    });
  }

  @Post('execute/bulk')
  @ApiOperation({
    summary: 'Execute bulk automated purchase',
    description: 'Execute automated purchasing for multiple reorder rules or products',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk automated purchase executed successfully',
    type: BulkAutomatedPurchaseResultDto,
  })
  @RequirePermissions('automation:purchasing:execute')
  async executeBulkAutomatedPurchase(
    @Body() bulkExecuteDto: ExecuteBulkAutomatedPurchaseDto,
    @Request() req: any,
  ): Promise<BulkAutomatedPurchaseResultDto> {
    return this.automatedPurchasingService.executeBulkAutomatedPurchase({
      ...bulkExecuteDto,
      tenantId: req.user.tenantId,
    });
  }

  @Post('process-rules')
  @ApiOperation({
    summary: 'Process automation rules',
    description: 'Process all eligible automation rules for the tenant',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation rules processed successfully',
    type: RuleEngineMetricsDto,
  })
  @RequirePermissions('automation:rules:execute')
  async processAutomationRules(
    @Body() processDto: ProcessAutomationRulesDto,
    @Request() req: any,
  ): Promise<RuleEngineMetricsDto> {
    // Convert DTO to RuleEvaluationContext
    const context = {
      currentTime: new Date(),
      inventoryThresholds: {
        criticalLevel: 10, // Default values
        warningLevel: 20,
      },
      budgetConstraints: {
        dailyLimit: processDto.budgetConstraint,
        monthlyLimit: processDto.budgetConstraint ? processDto.budgetConstraint * 30 : undefined,
      },
      systemLoad: {
        cpuUsage: 50,
        memoryUsage: 60,
        activeJobs: 5,
      },
    };
    
    return this.automationRuleEngine.processAutomationRules(req.user.tenantId, context);
  }

  @Get('eligible-rules')
  @ApiOperation({
    summary: 'Get eligible reorder rules',
    description: 'Get all reorder rules that are eligible for execution',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Eligible reorder rules retrieved successfully',
    type: [ReorderRule],
  })
  @RequirePermissions('automation:rules:read')
  async getEligibleReorderRules(@Request() req: any): Promise<ReorderRule[]> {
    return this.automatedPurchasingService.getEligibleReorderRulesForExecution(req.user.tenantId);
  }

  // =============================================
  // MONITORING & ANALYTICS
  // =============================================

  @Get('metrics/overview')
  @ApiOperation({
    summary: 'Get automation metrics overview',
    description: 'Get comprehensive metrics about automation performance',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation metrics retrieved successfully',
  })
  @RequirePermissions('automation:metrics:read')
  async getAutomationMetrics(@Request() req: any): Promise<{
    reorderRules: {
      total: number;
      active: number;
      paused: number;
      errors: number;
    };
    executions: {
      today: number;
      thisWeek: number;
      thisMonth: number;
      successRate: number;
    };
    purchaseOrders: {
      automated: number;
      totalValue: number;
      averageValue: number;
      pendingApprovals: number;
    };
    performance: {
      averageExecutionTime: number;
      systemEfficiency: number;
      errorRate: number;
    };
  }> {
    return this.automationRuleEngine.getAutomationMetrics(req.user.tenantId);
  }

  @Get('metrics/rules/:id')
  @ApiOperation({
    summary: 'Get reorder rule metrics',
    description: 'Get detailed performance metrics for a specific reorder rule',
  })
  @ApiParam({
    name: 'id',
    description: 'Reorder rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reorder rule metrics retrieved successfully',
  })
  @RequirePermissions('automation:metrics:read')
  async getReorderRuleMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<{
    executions: {
      total: number;
      successful: number;
      failed: number;
      averageOrderValue: number;
    };
    performance: {
      averageAccuracy: number;
      averageExecutionTime: number;
      lastExecuted: Date;
      nextDue: Date;
    };
    trends: {
      executionHistory: Array<{
        date: Date;
        executed: boolean;
        orderValue?: number;
        urgencyScore?: number;
      }>;
    };
  }> {
    return this.reorderCalculationService.getReorderRuleMetrics(req.user.tenantId, id);
  }

  @Get('health')
  @ApiOperation({
    summary: 'Get automation system health',
    description: 'Get current health status of the automation system',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation system health retrieved successfully',
  })
  @RequirePermissions('automation:system:read')
  async getAutomationHealth(@Request() req: any): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      ruleEngine: 'up' | 'down' | 'degraded';
      schedules: 'up' | 'down' | 'degraded';
      purchasingService: 'up' | 'down' | 'degraded';
      queueSystem: 'up' | 'down' | 'degraded';
    };
    metrics: {
      activeRules: number;
      runningJobs: number;
      queueDepth: number;
      lastProcessingTime: Date;
    };
    issues: string[];
  }> {
    return this.automationRuleEngine.getSystemHealth(req.user.tenantId);
  }

  // =============================================
  // DEBUGGING & TROUBLESHOOTING
  // =============================================

  @Get('debug/rule/:id')
  @ApiOperation({
    summary: 'Debug reorder rule',
    description: 'Get detailed debugging information for a reorder rule',
  })
  @ApiParam({
    name: 'id',
    description: 'Reorder rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reorder rule debug information retrieved successfully',
  })
  @RequirePermissions('automation:debug:read')
  async debugReorderRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<{
    rule: ReorderRule;
    eligibility: {
      isEligible: boolean;
      isDue: boolean;
      hasErrors: boolean;
      blockers: string[];
    };
    currentState: {
      currentStock: number;
      reorderPoint: number;
      urgencyScore: number;
      budgetRemaining: number;
    };
    nextActions: {
      nextReviewDate: Date;
      recommendedActions: string[];
    };
    troubleshooting: {
      commonIssues: string[];
      recommendations: string[];
    };
  }> {
    return this.reorderCalculationService.debugReorderRule(req.user.tenantId, id);
  }

  @Post('debug/simulate/:id')
  @ApiOperation({
    summary: 'Simulate reorder rule execution',
    description: 'Simulate the execution of a reorder rule with detailed step-by-step information',
  })
  @ApiParam({
    name: 'id',
    description: 'Reorder rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reorder rule simulation completed successfully',
  })
  @RequirePermissions('automation:debug:simulate')
  async simulateReorderRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() simulationOptions: { overrides?: any; scenarioData?: any },
    @Request() req: any,
  ): Promise<{
    simulation: {
      steps: Array<{
        step: string;
        result: any;
        duration: number;
        success: boolean;
        warnings?: string[];
        errors?: string[];
      }>;
      finalResult: AutomatedPurchaseResultDto;
      totalDuration: number;
    };
    recommendations: string[];
  }> {
    return this.reorderCalculationService.simulateReorderRule(
      req.user.tenantId,
      id,
      simulationOptions,
    );
  }
}