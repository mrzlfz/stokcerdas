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
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { UserEntity } from '../../auth/decorators/user.decorator';
import { User } from '../../users/entities/user.entity';

// Services
import { WorkflowBuilderService } from '../services/workflow-builder.service';
import { WorkflowExecutionService } from '../services/workflow-execution.service';
import { TriggerConfigurationService } from '../services/trigger-configuration.service';
import { ActionTemplateService } from '../services/action-template.service';

// DTOs
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  WorkflowQueryDto,
  TriggerWorkflowDto,
  WorkflowValidationResultDto,
  ReorderStepsDto,
  CloneWorkflowDto,
  CreateWorkflowStepDto,
  UpdateWorkflowStepDto,
  TriggerConfigDto,
} from '../dto/workflow.dto';

// Entities
import { 
  Workflow, 
  WorkflowStatus, 
  WorkflowTriggerType 
} from '../entities/workflow.entity';
import { WorkflowExecution } from '../entities/workflow-execution.entity';

@ApiTags('Workflows')
@Controller('workflows')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@ApiExtraModels(
  CreateWorkflowDto,
  UpdateWorkflowDto,
  WorkflowQueryDto,
  TriggerWorkflowDto,
  WorkflowValidationResultDto,
  CreateWorkflowStepDto,
  UpdateWorkflowStepDto,
)
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(
    private readonly workflowBuilderService: WorkflowBuilderService,
    private readonly workflowExecutionService: WorkflowExecutionService,
    private readonly triggerConfigurationService: TriggerConfigurationService,
    private readonly actionTemplateService: ActionTemplateService,
  ) {}

  // =============================================
  // WORKFLOW MANAGEMENT ENDPOINTS
  // =============================================

  @Get()
  @ApiOperation({ 
    summary: 'Get workflows', 
    description: 'Retrieve paginated list of workflows with filtering and search' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflows retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            workflows: {
              type: 'array',
              items: { $ref: '#/components/schemas/Workflow' },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
                total: { type: 'number', example: 25 },
                totalPages: { type: 'number', example: 3 },
              },
            },
          },
        },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async getWorkflows(
    @Request() req: any,
    @Query() query: WorkflowQueryDto,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const page = query.page || 1;
      const limit = Math.min(query.limit || 10, 100);
      const offset = (page - 1) * limit;

      // Build where conditions
      const whereConditions: any = {
        tenantId,
        deletedAt: null,
      };

      if (query.category) {
        whereConditions.category = query.category;
      }

      if (query.status) {
        whereConditions.status = query.status;
      }

      if (query.triggerType) {
        whereConditions.triggerType = query.triggerType;
      }

      if (query.ownerId) {
        whereConditions.ownerId = query.ownerId;
      }

      if (query.isActive !== undefined) {
        whereConditions.isActive = query.isActive;
      }

      // Execute query with pagination
      const [workflows, total] = await this.workflowBuilderService.findWorkflows({
        where: whereConditions,
        relations: ['owner', 'steps'],
        order: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'DESC',
        },
        take: limit,
        skip: offset,
      });

      return {
        success: true,
        data: {
          workflows: workflows.map(w => this.transformWorkflowResponse(w)),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };

    } catch (error) {
      this.logger.error(`Failed to get workflows: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get workflow by ID', 
    description: 'Retrieve detailed workflow information including steps' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/Workflow' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @RequirePermissions('workflow:read')
  async getWorkflowById(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const workflow = await this.workflowBuilderService.getWorkflowWithSteps(tenantId, workflowId);

      return {
        success: true,
        data: this.transformWorkflowResponse(workflow),
      };

    } catch (error) {
      this.logger.error(`Failed to get workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post()
  @ApiOperation({ 
    summary: 'Create workflow', 
    description: 'Create a new workflow with optional steps' 
  })
  @ApiBody({ type: CreateWorkflowDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Workflow created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/Workflow' },
        message: { type: 'string', example: 'Workflow berhasil dibuat' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid workflow data' })
  @ApiResponse({ status: 409, description: 'Workflow with same name already exists' })
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('workflow:create')
  async createWorkflow(
    @Request() req: any,
    @Body() createWorkflowDto: CreateWorkflowDto,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const workflow = await this.workflowBuilderService.createWorkflow(
        tenantId,
        createWorkflowDto,
        user.id,
      );

      return {
        success: true,
        data: this.transformWorkflowResponse(workflow),
        message: 'Workflow berhasil dibuat',
      };

    } catch (error) {
      this.logger.error(`Failed to create workflow: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update workflow', 
    description: 'Update workflow configuration and metadata' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiBody({ type: UpdateWorkflowDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/Workflow' },
        message: { type: 'string', example: 'Workflow berhasil diperbarui' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @RequirePermissions('workflow:update')
  async updateWorkflow(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const workflow = await this.workflowBuilderService.updateWorkflow(
        tenantId,
        workflowId,
        updateWorkflowDto,
        user.id,
      );

      return {
        success: true,
        data: this.transformWorkflowResponse(workflow),
        message: 'Workflow berhasil diperbarui',
      };

    } catch (error) {
      this.logger.error(`Failed to update workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete workflow', 
    description: 'Soft delete workflow and mark as inactive' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Workflow berhasil dihapus' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete active workflow' })
  @RequirePermissions('workflow:delete')
  async deleteWorkflow(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      await this.workflowBuilderService.deleteWorkflow(tenantId, workflowId, user.id);

      return {
        success: true,
        message: 'Workflow berhasil dihapus',
      };

    } catch (error) {
      this.logger.error(`Failed to delete workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/clone')
  @ApiOperation({ 
    summary: 'Clone workflow', 
    description: 'Create a copy of existing workflow with optional customizations' 
  })
  @ApiParam({ name: 'id', description: 'Source workflow ID', type: 'string' })
  @ApiBody({ type: CloneWorkflowDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Workflow cloned successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/Workflow' },
        message: { type: 'string', example: 'Workflow berhasil di-clone' },
      },
    },
  })
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('workflow:create')
  async cloneWorkflow(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) sourceWorkflowId: string,
    @Body() cloneWorkflowDto: CloneWorkflowDto,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const workflow = await this.workflowBuilderService.cloneWorkflow(
        tenantId,
        sourceWorkflowId,
        cloneWorkflowDto.newName,
        user.id,
      );

      return {
        success: true,
        data: this.transformWorkflowResponse(workflow),
        message: 'Workflow berhasil di-clone',
      };

    } catch (error) {
      this.logger.error(`Failed to clone workflow ${sourceWorkflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/version')
  @ApiOperation({ 
    summary: 'Create workflow version', 
    description: 'Create a new version of existing workflow' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiResponse({ 
    status: 201, 
    description: 'Workflow version created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/Workflow' },
        message: { type: 'string', example: 'Versi workflow berhasil dibuat' },
      },
    },
  })
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('workflow:create')
  async createWorkflowVersion(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const workflow = await this.workflowBuilderService.createWorkflowVersion(
        tenantId,
        workflowId,
        user.id,
      );

      return {
        success: true,
        data: this.transformWorkflowResponse(workflow),
        message: 'Versi workflow berhasil dibuat',
      };

    } catch (error) {
      this.logger.error(`Failed to create workflow version ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // WORKFLOW STEP MANAGEMENT ENDPOINTS
  // =============================================

  @Get(':id/steps')
  @ApiOperation({ 
    summary: 'Get workflow steps', 
    description: 'Retrieve all steps for a workflow in execution order' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow steps retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/WorkflowStep' },
        },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async getWorkflowSteps(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const workflow = await this.workflowBuilderService.getWorkflowWithSteps(tenantId, workflowId);

      return {
        success: true,
        data: workflow.steps?.sort((a, b) => a.executionOrder - b.executionOrder) || [],
      };

    } catch (error) {
      this.logger.error(`Failed to get workflow steps ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/steps')
  @ApiOperation({ 
    summary: 'Add workflow step', 
    description: 'Add a new step to the workflow' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiBody({ type: CreateWorkflowStepDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Workflow step added successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/WorkflowStep' },
        message: { type: 'string', example: 'Step berhasil ditambahkan' },
      },
    },
  })
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('workflow:update')
  async addWorkflowStep(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Body() createStepDto: CreateWorkflowStepDto,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const step = await this.workflowBuilderService.addWorkflowStep(
        tenantId,
        workflowId,
        createStepDto,
        user.id,
      );

      return {
        success: true,
        data: step,
        message: 'Step berhasil ditambahkan',
      };

    } catch (error) {
      this.logger.error(`Failed to add workflow step: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put(':id/steps/:stepId')
  @ApiOperation({ 
    summary: 'Update workflow step', 
    description: 'Update step configuration and settings' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiParam({ name: 'stepId', description: 'Step ID', type: 'string' })
  @ApiBody({ type: UpdateWorkflowStepDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow step updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/WorkflowStep' },
        message: { type: 'string', example: 'Step berhasil diperbarui' },
      },
    },
  })
  @RequirePermissions('workflow:update')
  async updateWorkflowStep(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() updateStepDto: UpdateWorkflowStepDto,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const step = await this.workflowBuilderService.updateWorkflowStep(
        tenantId,
        workflowId,
        stepId,
        updateStepDto,
        user.id,
      );

      return {
        success: true,
        data: step,
        message: 'Step berhasil diperbarui',
      };

    } catch (error) {
      this.logger.error(`Failed to update workflow step: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id/steps/:stepId')
  @ApiOperation({ 
    summary: 'Delete workflow step', 
    description: 'Remove step from workflow' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiParam({ name: 'stepId', description: 'Step ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow step deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Step berhasil dihapus' },
      },
    },
  })
  @RequirePermissions('workflow:update')
  async deleteWorkflowStep(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      await this.workflowBuilderService.deleteWorkflowStep(
        tenantId,
        workflowId,
        stepId,
        user.id,
      );

      return {
        success: true,
        message: 'Step berhasil dihapus',
      };

    } catch (error) {
      this.logger.error(`Failed to delete workflow step: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch(':id/steps/reorder')
  @ApiOperation({ 
    summary: 'Reorder workflow steps', 
    description: 'Update execution order of workflow steps' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiBody({ type: ReorderStepsDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow steps reordered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Urutan step berhasil diubah' },
      },
    },
  })
  @RequirePermissions('workflow:update')
  async reorderWorkflowSteps(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Body() reorderDto: ReorderStepsDto,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      await this.workflowBuilderService.reorderWorkflowSteps(
        tenantId,
        workflowId,
        reorderDto.stepOrders,
        user.id,
      );

      return {
        success: true,
        message: 'Urutan step berhasil diubah',
      };

    } catch (error) {
      this.logger.error(`Failed to reorder workflow steps: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // WORKFLOW EXECUTION ENDPOINTS
  // =============================================

  @Post(':id/trigger')
  @ApiOperation({ 
    summary: 'Trigger workflow execution', 
    description: 'Manually trigger workflow execution with optional input data' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiBody({ type: TriggerWorkflowDto })
  @ApiResponse({ 
    status: 202, 
    description: 'Workflow execution triggered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            executionId: { type: 'string', example: 'exec_1234567890_abcdef' },
            status: { type: 'string', example: 'running' },
            startedAt: { type: 'string', format: 'date-time' },
          },
        },
        message: { type: 'string', example: 'Workflow execution dimulai' },
      },
    },
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('workflow:execute')
  async triggerWorkflow(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Body() triggerDto: TriggerWorkflowDto,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const executionId = await this.triggerConfigurationService.triggerWorkflow(
        tenantId,
        workflowId,
        triggerDto.inputData,
        user.id,
        triggerDto.triggerSource || 'manual_api',
      );

      return {
        success: true,
        data: {
          executionId,
          status: 'running',
          startedAt: new Date(),
        },
        message: 'Workflow execution dimulai',
      };

    } catch (error) {
      this.logger.error(`Failed to trigger workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':id/executions')
  @ApiOperation({ 
    summary: 'Get workflow executions', 
    description: 'Retrieve execution history for workflow' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow executions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            executions: {
              type: 'array',
              items: { $ref: '#/components/schemas/WorkflowExecution' },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
                total: { type: 'number', example: 25 },
              },
            },
          },
        },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async getWorkflowExecutions(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const executions = await this.workflowExecutionService.getWorkflowExecutions(
        tenantId,
        workflowId,
        {
          page,
          limit: Math.min(limit, 100),
          status,
        }
      );

      return {
        success: true,
        data: executions,
      };

    } catch (error) {
      this.logger.error(`Failed to get workflow executions: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('executions/:executionId')
  @ApiOperation({ 
    summary: 'Get execution details', 
    description: 'Retrieve detailed execution information and step results' 
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Execution details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/WorkflowExecution' },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async getExecutionDetails(
    @Request() req: any,
    @Param('executionId') executionId: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const execution = await this.workflowExecutionService.getExecutionDetails(
        tenantId,
        executionId,
      );

      return {
        success: true,
        data: execution,
      };

    } catch (error) {
      this.logger.error(`Failed to get execution details: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch('executions/:executionId/pause')
  @ApiOperation({ 
    summary: 'Pause workflow execution', 
    description: 'Pause a running workflow execution' 
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID', type: 'string' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Manual pause for review' },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Execution paused successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Execution berhasil di-pause' },
      },
    },
  })
  @RequirePermissions('workflow:execute')
  async pauseExecution(
    @Request() req: any,
    @Param('executionId') executionId: string,
    @Body('reason') reason?: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      await this.workflowExecutionService.pauseWorkflowExecution(
        tenantId,
        executionId,
        reason,
      );

      return {
        success: true,
        message: 'Execution berhasil di-pause',
      };

    } catch (error) {
      this.logger.error(`Failed to pause execution: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch('executions/:executionId/resume')
  @ApiOperation({ 
    summary: 'Resume workflow execution', 
    description: 'Resume a paused workflow execution' 
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Execution resumed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Execution berhasil di-resume' },
      },
    },
  })
  @RequirePermissions('workflow:execute')
  async resumeExecution(
    @Request() req: any,
    @Param('executionId') executionId: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      await this.workflowExecutionService.resumeWorkflowExecution(
        tenantId,
        executionId,
      );

      return {
        success: true,
        message: 'Execution berhasil di-resume',
      };

    } catch (error) {
      this.logger.error(`Failed to resume execution: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch('executions/:executionId/cancel')
  @ApiOperation({ 
    summary: 'Cancel workflow execution', 
    description: 'Cancel a running or paused workflow execution' 
  })
  @ApiParam({ name: 'executionId', description: 'Execution ID', type: 'string' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Manual cancellation' },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Execution cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Execution berhasil dibatalkan' },
      },
    },
  })
  @RequirePermissions('workflow:execute')
  async cancelExecution(
    @Request() req: any,
    @Param('executionId') executionId: string,
    @Body('reason') reason?: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      await this.workflowExecutionService.cancelWorkflowExecution(
        tenantId,
        executionId,
        reason,
      );

      return {
        success: true,
        message: 'Execution berhasil dibatalkan',
      };

    } catch (error) {
      this.logger.error(`Failed to cancel execution: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // WORKFLOW VALIDATION AND TESTING ENDPOINTS
  // =============================================

  @Post(':id/validate')
  @ApiOperation({ 
    summary: 'Validate workflow', 
    description: 'Validate workflow configuration and steps' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow validation completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/WorkflowValidationResultDto' },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async validateWorkflow(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const validationResult = await this.workflowBuilderService.validateWorkflow(
        tenantId,
        workflowId,
      );

      return {
        success: true,
        data: validationResult,
      };

    } catch (error) {
      this.logger.error(`Failed to validate workflow: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/test')
  @ApiOperation({ 
    summary: 'Test workflow', 
    description: 'Run workflow validation and generate test scenarios' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        testData: { 
          type: 'object',
          description: 'Test input data for workflow',
          example: { productId: 'test-123', quantity: 10 },
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow test completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            validationResult: { $ref: '#/components/schemas/WorkflowValidationResultDto' },
            testScenarios: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  inputData: { type: 'object' },
                },
              },
            },
            estimatedExecutionTime: { type: 'number', description: 'Estimated time in milliseconds' },
            resourceRequirements: { type: 'object' },
          },
        },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async testWorkflow(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Body('testData') testData?: Record<string, any>,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const testResult = await this.workflowBuilderService.testWorkflow(
        tenantId,
        workflowId,
        testData,
      );

      return {
        success: true,
        data: testResult,
      };

    } catch (error) {
      this.logger.error(`Failed to test workflow: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // TRIGGER CONFIGURATION ENDPOINTS
  // =============================================

  @Put(':id/trigger-config')
  @ApiOperation({ 
    summary: 'Configure workflow trigger', 
    description: 'Update workflow trigger configuration' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiBody({ type: TriggerConfigDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Trigger configuration updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/Workflow' },
        message: { type: 'string', example: 'Trigger configuration berhasil diperbarui' },
      },
    },
  })
  @RequirePermissions('workflow:update')
  async configureTrigger(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Body() triggerConfigDto: TriggerConfigDto,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const workflow = await this.triggerConfigurationService.updateTriggerConfiguration(
        tenantId,
        workflowId,
        triggerConfigDto,
        user.id,
      );

      return {
        success: true,
        data: this.transformWorkflowResponse(workflow),
        message: 'Trigger configuration berhasil diperbarui',
      };

    } catch (error) {
      this.logger.error(`Failed to configure trigger: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch(':id/enable')
  @ApiOperation({ 
    summary: 'Enable workflow', 
    description: 'Activate workflow and enable triggers' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow enabled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Workflow berhasil diaktifkan' },
      },
    },
  })
  @RequirePermissions('workflow:update')
  async enableWorkflow(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      await this.workflowBuilderService.updateWorkflow(
        tenantId,
        workflowId,
        { isActive: true, status: WorkflowStatus.ACTIVE },
        user.id,
      );

      return {
        success: true,
        message: 'Workflow berhasil diaktifkan',
      };

    } catch (error) {
      this.logger.error(`Failed to enable workflow: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch(':id/disable')
  @ApiOperation({ 
    summary: 'Disable workflow', 
    description: 'Deactivate workflow and disable triggers' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow disabled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Workflow berhasil dinonaktifkan' },
      },
    },
  })
  @RequirePermissions('workflow:update')
  async disableWorkflow(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @UserEntity() user: User,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      await this.triggerConfigurationService.disableTrigger(
        tenantId,
        workflowId,
        user.id,
      );

      return {
        success: true,
        message: 'Workflow berhasil dinonaktifkan',
      };

    } catch (error) {
      this.logger.error(`Failed to disable workflow: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // TEMPLATE ENDPOINTS
  // =============================================

  @Get('/templates/actions')
  @ApiOperation({ 
    summary: 'Get action templates', 
    description: 'Retrieve available action templates for workflow steps' 
  })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiQuery({ name: 'difficulty', required: false, enum: ['beginner', 'intermediate', 'advanced'] })
  @ApiResponse({ 
    status: 200, 
    description: 'Action templates retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ActionTemplate' },
        },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async getActionTemplates(
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    try {
      const templates = await this.actionTemplateService.getActionTemplates(category, difficulty);

      return {
        success: true,
        data: templates,
      };

    } catch (error) {
      this.logger.error(`Failed to get action templates: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('/templates/workflows')
  @ApiOperation({ 
    summary: 'Get workflow templates', 
    description: 'Retrieve available workflow templates' 
  })
  @ApiQuery({ name: 'category', required: false, enum: ['inventory_management', 'purchase_order', 'supplier_management', 'alert_notification', 'reporting', 'data_sync', 'maintenance', 'custom'] })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow templates retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/WorkflowTemplate' },
        },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async getWorkflowTemplates(
    @Query('category') category?: string,
  ) {
    try {
      const templates = await this.actionTemplateService.getWorkflowTemplates(category as any);

      return {
        success: true,
        data: templates,
      };

    } catch (error) {
      this.logger.error(`Failed to get workflow templates: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('/templates/search')
  @ApiOperation({ 
    summary: 'Search templates', 
    description: 'Search both action and workflow templates' 
  })
  @ApiQuery({ name: 'query', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'type', required: false, enum: ['action', 'workflow', 'both'], description: 'Template type to search' })
  @ApiResponse({ 
    status: 200, 
    description: 'Templates search completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            actionTemplates: {
              type: 'array',
              items: { $ref: '#/components/schemas/ActionTemplate' },
            },
            workflowTemplates: {
              type: 'array',
              items: { $ref: '#/components/schemas/WorkflowTemplate' },
            },
          },
        },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async searchTemplates(
    @Query('query') query: string,
    @Query('type') type: 'action' | 'workflow' | 'both' = 'both',
  ) {
    try {
      const searchResults = await this.actionTemplateService.searchTemplates(query, type);

      return {
        success: true,
        data: searchResults,
      };

    } catch (error) {
      this.logger.error(`Failed to search templates: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // ANALYTICS AND MONITORING ENDPOINTS
  // =============================================

  @Get(':id/analytics')
  @ApiOperation({ 
    summary: 'Get workflow analytics', 
    description: 'Retrieve workflow performance analytics and metrics' 
  })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: 'string' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'], description: 'Analytics period' })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            executionMetrics: { type: 'object' },
            performanceMetrics: { type: 'object' },
            errorAnalysis: { type: 'object' },
            trendAnalysis: { type: 'object' },
          },
        },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async getWorkflowAnalytics(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Query('period') period: string = '30d',
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const analytics = await this.workflowExecutionService.getWorkflowAnalytics(
        tenantId,
        workflowId,
        period,
      );

      return {
        success: true,
        data: analytics,
      };

    } catch (error) {
      this.logger.error(`Failed to get workflow analytics: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('/dashboard/summary')
  @ApiOperation({ 
    summary: 'Get workflow dashboard summary', 
    description: 'Retrieve overall workflow metrics and status summary' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Dashboard summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            totalWorkflows: { type: 'number' },
            activeWorkflows: { type: 'number' },
            totalExecutions: { type: 'number' },
            successRate: { type: 'number' },
            recentExecutions: { type: 'array' },
            topPerformingWorkflows: { type: 'array' },
          },
        },
      },
    },
  })
  @RequirePermissions('workflow:read')
  async getDashboardSummary(
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      
      const summary = await this.workflowExecutionService.getDashboardSummary(tenantId);

      return {
        success: true,
        data: summary,
      };

    } catch (error) {
      this.logger.error(`Failed to get dashboard summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private transformWorkflowResponse(workflow: Workflow): any {
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      category: workflow.category,
      status: workflow.status,
      triggerType: workflow.triggerType,
      priority: workflow.priority,
      isActive: workflow.isActive,
      version: workflow.version,
      totalExecutions: workflow.totalExecutions,
      successfulExecutions: workflow.successfulExecutions,
      failedExecutions: workflow.failedExecutions,
      successRate: workflow.successRate,
      averageExecutionTime: workflow.averageExecutionTime,
      lastExecutionAt: workflow.lastExecutionAt,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      owner: workflow.owner ? {
        id: workflow.owner.id,
        name: workflow.owner.name,
        email: workflow.owner.email,
      } : null,
      steps: workflow.steps?.length || 0,
      triggerConfig: workflow.triggerConfig,
      workflowConfig: workflow.workflowConfig,
      notificationConfig: workflow.notificationConfig,
      variables: workflow.variables,
      tags: workflow.tags,
      metadata: workflow.metadata,
    };
  }
}