import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as moment from 'moment-timezone';

import { 
  Workflow, 
  WorkflowStatus, 
  WorkflowTriggerType, 
  WorkflowCategory, 
  WorkflowPriority 
} from '../entities/workflow.entity';
import { 
  WorkflowStep, 
  WorkflowStepType, 
  WorkflowStepStatus 
} from '../entities/workflow-step.entity';
import { User } from '../../users/entities/user.entity';

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  category: WorkflowCategory;
  triggerType: WorkflowTriggerType;
  priority?: WorkflowPriority;
  triggerConfig?: any;
  workflowConfig?: any;
  notificationConfig?: any;
  variables?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
  ownerId?: string;
  permissions?: any;
  steps?: CreateWorkflowStepRequest[];
}

export interface CreateWorkflowStepRequest {
  name: string;
  description?: string;
  stepType: WorkflowStepType;
  executionOrder: number;
  stepConfig?: any;
  inputMapping?: any;
  outputMapping?: any;
  errorHandling?: any;
  executionConditions?: any;
  dependencies?: any;
  timeoutSeconds?: number;
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  isOptional?: boolean;
  canSkip?: boolean;
  isCritical?: boolean;
  uiConfig?: any;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  category?: WorkflowCategory;
  triggerType?: WorkflowTriggerType;
  priority?: WorkflowPriority;
  triggerConfig?: any;
  workflowConfig?: any;
  notificationConfig?: any;
  variables?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
  permissions?: any;
}

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  template: Partial<Workflow>;
  steps: Partial<WorkflowStep>[];
  metadata: {
    author: string;
    version: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedDuration: number; // in minutes
  };
}

@Injectable()
export class WorkflowBuilderService {
  private readonly logger = new Logger(WorkflowBuilderService.name);
  private readonly cachePrefix = 'workflow_builder';

  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowStep)
    private readonly workflowStepRepository: Repository<WorkflowStep>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =============================================
  // WORKFLOW CREATION AND MANAGEMENT
  // =============================================

  async createWorkflow(
    tenantId: string,
    request: CreateWorkflowRequest,
    createdBy?: string,
  ): Promise<Workflow> {
    try {
      this.logger.log(`Creating workflow ${request.name} for tenant ${tenantId}`);

      // Validate request
      await this.validateWorkflowRequest(tenantId, request);

      // Check for name conflicts
      await this.checkNameConflict(tenantId, request.name);

      // Start transaction for atomic creation
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Create workflow
        const workflow = this.workflowRepository.create({
          tenantId,
          name: request.name,
          description: request.description,
          category: request.category,
          triggerType: request.triggerType,
          priority: request.priority || WorkflowPriority.NORMAL,
          triggerConfig: request.triggerConfig,
          workflowConfig: request.workflowConfig,
          notificationConfig: request.notificationConfig,
          variables: request.variables,
          tags: request.tags,
          metadata: request.metadata,
          ownerId: request.ownerId,
          permissions: request.permissions,
          status: WorkflowStatus.DRAFT,
          isActive: false,
          createdBy,
        });

        const savedWorkflow = await queryRunner.manager.save(workflow);

        // Create workflow steps if provided
        if (request.steps && request.steps.length > 0) {
          const steps = await this.createWorkflowSteps(
            queryRunner,
            savedWorkflow.id,
            tenantId,
            request.steps,
            createdBy,
          );
          savedWorkflow.steps = steps;
        }

        await queryRunner.commitTransaction();

        // Clear cache
        await this.clearWorkflowCache(tenantId);

        // Emit event
        this.eventEmitter.emit('workflow.created', {
          tenantId,
          workflowId: savedWorkflow.id,
          workflowName: savedWorkflow.name,
          createdBy,
        });

        this.logger.log(`Workflow ${savedWorkflow.name} created successfully with ID ${savedWorkflow.id}`);
        return savedWorkflow;

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }

    } catch (error) {
      this.logger.error(`Failed to create workflow: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateWorkflow(
    tenantId: string,
    workflowId: string,
    request: UpdateWorkflowRequest,
    updatedBy?: string,
  ): Promise<Workflow> {
    try {
      this.logger.log(`Updating workflow ${workflowId} for tenant ${tenantId}`);

      const workflow = await this.getWorkflowById(tenantId, workflowId);

      // Check if workflow can be edited
      if (workflow.status === WorkflowStatus.ACTIVE && workflow.totalExecutions > 0) {
        throw new BadRequestException('Tidak dapat mengubah workflow yang sedang aktif dan memiliki riwayat eksekusi');
      }

      // Validate name conflict if name is being changed
      if (request.name && request.name !== workflow.name) {
        await this.checkNameConflict(tenantId, request.name, workflowId);
      }

      // Update workflow properties
      Object.assign(workflow, {
        ...request,
        updatedBy,
        updatedAt: new Date(),
      });

      const updatedWorkflow = await this.workflowRepository.save(workflow);

      // Clear cache
      await this.clearWorkflowCache(tenantId, workflowId);

      // Emit event
      this.eventEmitter.emit('workflow.updated', {
        tenantId,
        workflowId,
        workflowName: updatedWorkflow.name,
        updatedBy,
        changes: request,
      });

      this.logger.log(`Workflow ${workflowId} updated successfully`);
      return updatedWorkflow;

    } catch (error) {
      this.logger.error(`Failed to update workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteWorkflow(
    tenantId: string,
    workflowId: string,
    deletedBy?: string,
  ): Promise<void> {
    try {
      this.logger.log(`Deleting workflow ${workflowId} for tenant ${tenantId}`);

      const workflow = await this.getWorkflowById(tenantId, workflowId);

      // Check if workflow can be deleted
      if (workflow.status === WorkflowStatus.ACTIVE) {
        throw new BadRequestException('Tidak dapat menghapus workflow yang sedang aktif');
      }

      // Soft delete
      workflow.deletedAt = new Date();
      workflow.deletedBy = deletedBy;
      await this.workflowRepository.save(workflow);

      // Clear cache
      await this.clearWorkflowCache(tenantId, workflowId);

      // Emit event
      this.eventEmitter.emit('workflow.deleted', {
        tenantId,
        workflowId,
        workflowName: workflow.name,
        deletedBy,
      });

      this.logger.log(`Workflow ${workflowId} deleted successfully`);

    } catch (error) {
      this.logger.error(`Failed to delete workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // WORKFLOW STEP MANAGEMENT
  // =============================================

  async addWorkflowStep(
    tenantId: string,
    workflowId: string,
    stepRequest: CreateWorkflowStepRequest,
    createdBy?: string,
  ): Promise<WorkflowStep> {
    try {
      this.logger.log(`Adding step ${stepRequest.name} to workflow ${workflowId}`);

      const workflow = await this.getWorkflowById(tenantId, workflowId);

      // Validate step request
      this.validateStepRequest(stepRequest);

      // Create step
      const step = this.workflowStepRepository.create({
        tenantId,
        workflowId,
        name: stepRequest.name,
        description: stepRequest.description,
        stepType: stepRequest.stepType,
        executionOrder: stepRequest.executionOrder,
        stepConfig: stepRequest.stepConfig,
        inputMapping: stepRequest.inputMapping,
        outputMapping: stepRequest.outputMapping,
        errorHandling: stepRequest.errorHandling,
        executionConditions: stepRequest.executionConditions,
        dependencies: stepRequest.dependencies,
        timeoutSeconds: stepRequest.timeoutSeconds,
        maxMemoryMB: stepRequest.maxMemoryMB,
        maxCpuPercent: stepRequest.maxCpuPercent,
        maxRetries: stepRequest.maxRetries || 3,
        retryDelayMs: stepRequest.retryDelayMs,
        isOptional: stepRequest.isOptional || false,
        canSkip: stepRequest.canSkip || false,
        isCritical: stepRequest.isCritical || false,
        uiConfig: stepRequest.uiConfig,
        createdBy,
      });

      const savedStep = await this.workflowStepRepository.save(step);

      // Update workflow total steps count
      await this.updateWorkflowStepsCount(workflowId);

      // Clear cache
      await this.clearWorkflowCache(tenantId, workflowId);

      this.logger.log(`Step ${savedStep.name} added to workflow ${workflowId}`);
      return savedStep;

    } catch (error) {
      this.logger.error(`Failed to add step to workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateWorkflowStep(
    tenantId: string,
    workflowId: string,
    stepId: string,
    stepRequest: Partial<CreateWorkflowStepRequest>,
    updatedBy?: string,
  ): Promise<WorkflowStep> {
    try {
      this.logger.log(`Updating step ${stepId} in workflow ${workflowId}`);

      const step = await this.getWorkflowStepById(tenantId, workflowId, stepId);

      // Update step properties
      Object.assign(step, {
        ...stepRequest,
        updatedBy,
        updatedAt: new Date(),
      });

      const updatedStep = await this.workflowStepRepository.save(step);

      // Clear cache
      await this.clearWorkflowCache(tenantId, workflowId);

      this.logger.log(`Step ${stepId} updated successfully`);
      return updatedStep;

    } catch (error) {
      this.logger.error(`Failed to update step ${stepId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteWorkflowStep(
    tenantId: string,
    workflowId: string,
    stepId: string,
    deletedBy?: string,
  ): Promise<void> {
    try {
      this.logger.log(`Deleting step ${stepId} from workflow ${workflowId}`);

      const step = await this.getWorkflowStepById(tenantId, workflowId, stepId);

      // Soft delete
      step.deletedAt = new Date();
      step.deletedBy = deletedBy;
      await this.workflowStepRepository.save(step);

      // Update workflow steps count
      await this.updateWorkflowStepsCount(workflowId);

      // Clear cache
      await this.clearWorkflowCache(tenantId, workflowId);

      this.logger.log(`Step ${stepId} deleted successfully`);

    } catch (error) {
      this.logger.error(`Failed to delete step ${stepId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async reorderWorkflowSteps(
    tenantId: string,
    workflowId: string,
    stepOrders: Array<{ stepId: string; order: number }>,
    updatedBy?: string,
  ): Promise<void> {
    try {
      this.logger.log(`Reordering steps in workflow ${workflowId}`);

      const workflow = await this.getWorkflowById(tenantId, workflowId);

      // Start transaction
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        for (const { stepId, order } of stepOrders) {
          await queryRunner.manager.update(WorkflowStep, 
            { id: stepId, tenantId, workflowId },
            { executionOrder: order, updatedBy, updatedAt: new Date() }
          );
        }

        await queryRunner.commitTransaction();

        // Clear cache
        await this.clearWorkflowCache(tenantId, workflowId);

        this.logger.log(`Steps reordered successfully in workflow ${workflowId}`);

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }

    } catch (error) {
      this.logger.error(`Failed to reorder steps in workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // WORKFLOW VALIDATION AND TESTING
  // =============================================

  async validateWorkflow(tenantId: string, workflowId: string): Promise<WorkflowValidationResult> {
    try {
      const workflow = await this.getWorkflowWithSteps(tenantId, workflowId);
      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      // Validate workflow configuration
      const workflowValidation = workflow.validateConfiguration();
      errors.push(...workflowValidation.errors);

      // Validate steps
      if (!workflow.steps || workflow.steps.length === 0) {
        errors.push('Workflow harus memiliki minimal satu step');
      } else {
        for (const step of workflow.steps) {
          const stepValidation = step.validateConfiguration();
          errors.push(...stepValidation.errors.map(err => `Step "${step.name}": ${err}`));
        }

        // Check step order continuity
        const orders = workflow.steps.map(s => s.executionOrder).sort((a, b) => a - b);
        for (let i = 0; i < orders.length - 1; i++) {
          if (orders[i + 1] - orders[i] > 1) {
            warnings.push(`Gap dalam execution order antara step ${orders[i]} dan ${orders[i + 1]}`);
          }
        }

        // Check for unreachable steps
        this.checkUnreachableSteps(workflow.steps, warnings);

        // Performance suggestions
        this.generatePerformanceSuggestions(workflow, suggestions);
      }

      // Validate trigger configuration
      this.validateTriggerConfiguration(workflow, errors, warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };

    } catch (error) {
      this.logger.error(`Failed to validate workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async testWorkflow(
    tenantId: string,
    workflowId: string,
    testData?: Record<string, any>,
  ): Promise<any> {
    try {
      this.logger.log(`Testing workflow ${workflowId} with test data`);

      const validation = await this.validateWorkflow(tenantId, workflowId);
      if (!validation.isValid) {
        throw new BadRequestException(`Workflow tidak valid: ${validation.errors.join(', ')}`);
      }

      // This would integrate with WorkflowExecutionService for dry-run execution
      // For now, return validation result and suggested test scenarios
      return {
        validationResult: validation,
        testScenarios: this.generateTestScenarios(tenantId, workflowId),
        estimatedExecutionTime: await this.estimateExecutionTime(tenantId, workflowId),
        resourceRequirements: await this.estimateResourceRequirements(tenantId, workflowId),
      };

    } catch (error) {
      this.logger.error(`Failed to test workflow ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // WORKFLOW TEMPLATES AND CLONING
  // =============================================

  async createWorkflowFromTemplate(
    tenantId: string,
    templateId: string,
    customizations?: Partial<CreateWorkflowRequest>,
    createdBy?: string,
  ): Promise<Workflow> {
    try {
      this.logger.log(`Creating workflow from template ${templateId} for tenant ${tenantId}`);

      const template = await this.getWorkflowTemplate(templateId);
      if (!template) {
        throw new NotFoundException(`Template ${templateId} tidak ditemukan`);
      }

      // Merge template with customizations
      const workflowRequest: CreateWorkflowRequest = {
        ...template.template,
        ...customizations,
        name: customizations?.name || `${template.name} - Copy`,
        templateId,
      } as CreateWorkflowRequest;

      workflowRequest.steps = template.steps.map(stepTemplate => ({
        ...stepTemplate,
        ...customizations?.steps?.find(s => s.name === stepTemplate.name),
      })) as CreateWorkflowStepRequest[];

      return await this.createWorkflow(tenantId, workflowRequest, createdBy);

    } catch (error) {
      this.logger.error(`Failed to create workflow from template ${templateId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async cloneWorkflow(
    tenantId: string,
    sourceWorkflowId: string,
    newName?: string,
    createdBy?: string,
  ): Promise<Workflow> {
    try {
      this.logger.log(`Cloning workflow ${sourceWorkflowId} for tenant ${tenantId}`);

      const sourceWorkflow = await this.getWorkflowWithSteps(tenantId, sourceWorkflowId);

      const cloneRequest: CreateWorkflowRequest = {
        name: newName || `${sourceWorkflow.name} - Copy`,
        description: sourceWorkflow.description,
        category: sourceWorkflow.category,
        triggerType: sourceWorkflow.triggerType,
        priority: sourceWorkflow.priority,
        triggerConfig: JSON.parse(JSON.stringify(sourceWorkflow.triggerConfig)),
        workflowConfig: JSON.parse(JSON.stringify(sourceWorkflow.workflowConfig)),
        notificationConfig: JSON.parse(JSON.stringify(sourceWorkflow.notificationConfig)),
        variables: JSON.parse(JSON.stringify(sourceWorkflow.variables)),
        tags: [...(sourceWorkflow.tags || [])],
        metadata: JSON.parse(JSON.stringify(sourceWorkflow.metadata)),
        ownerId: sourceWorkflow.ownerId,
        permissions: JSON.parse(JSON.stringify(sourceWorkflow.permissions)),
        steps: sourceWorkflow.steps?.map(step => step.clone()) as CreateWorkflowStepRequest[],
      };

      return await this.createWorkflow(tenantId, cloneRequest, createdBy);

    } catch (error) {
      this.logger.error(`Failed to clone workflow ${sourceWorkflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createWorkflowVersion(
    tenantId: string,
    workflowId: string,
    createdBy?: string,
  ): Promise<Workflow> {
    try {
      this.logger.log(`Creating new version of workflow ${workflowId}`);

      const currentWorkflow = await this.getWorkflowWithSteps(tenantId, workflowId);
      const newVersionData = currentWorkflow.createNewVersion();

      const newVersionRequest: CreateWorkflowRequest = {
        ...newVersionData,
        steps: currentWorkflow.steps?.map(step => step.clone()) as CreateWorkflowStepRequest[],
      } as CreateWorkflowRequest;

      return await this.createWorkflow(tenantId, newVersionRequest, createdBy);

    } catch (error) {
      this.logger.error(`Failed to create workflow version for ${workflowId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // QUERY AND RETRIEVAL METHODS
  // =============================================

  async getWorkflowById(tenantId: string, workflowId: string): Promise<Workflow> {
    const cacheKey = `${this.cachePrefix}:workflow:${tenantId}:${workflowId}`;
    
    let workflow = await this.cacheManager.get<Workflow>(cacheKey);
    if (!workflow) {
      workflow = await this.workflowRepository.findOne({
        where: { id: workflowId, tenantId, deletedAt: null },
        relations: ['owner'],
      });

      if (!workflow) {
        throw new NotFoundException(`Workflow ${workflowId} tidak ditemukan`);
      }

      await this.cacheManager.set(cacheKey, workflow, 300); // 5 minutes
    }

    return workflow;
  }

  async getWorkflowWithSteps(tenantId: string, workflowId: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId, tenantId, deletedAt: null },
      relations: ['steps', 'owner'],
      order: { steps: { executionOrder: 'ASC' } },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} tidak ditemukan`);
    }

    return workflow;
  }

  async getWorkflowStepById(
    tenantId: string,
    workflowId: string,
    stepId: string,
  ): Promise<WorkflowStep> {
    const step = await this.workflowStepRepository.findOne({
      where: { 
        id: stepId, 
        tenantId, 
        workflowId, 
        deletedAt: null 
      },
    });

    if (!step) {
      throw new NotFoundException(`Workflow step ${stepId} tidak ditemukan`);
    }

    return step;
  }

  // Find workflows with pagination
  async findWorkflows(query: any): Promise<[Workflow[], number]> {
    const {
      tenantId,
      category,
      status,
      triggerType,
      ownerId,
      search,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const where: any = { tenantId, deletedAt: null };
    
    if (category) where.category = category;
    if (status) where.status = status;
    if (triggerType) where.triggerType = triggerType;
    if (ownerId) where.ownerId = ownerId;
    
    const queryBuilder = this.workflowRepository.createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.owner', 'owner')
      .where(where);

    if (search) {
      queryBuilder.andWhere(
        '(workflow.name ILIKE :search OR workflow.description ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('workflow.tags && :tags', { tags });
    }

    const total = await queryBuilder.getCount();
    
    const workflows = await queryBuilder
      .orderBy(`workflow.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return [workflows, total];
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private async createWorkflowSteps(
    queryRunner: QueryRunner,
    workflowId: string,
    tenantId: string,
    stepRequests: CreateWorkflowStepRequest[],
    createdBy?: string,
  ): Promise<WorkflowStep[]> {
    const steps: WorkflowStep[] = [];

    for (const stepRequest of stepRequests) {
      const step = this.workflowStepRepository.create({
        tenantId,
        workflowId,
        ...stepRequest,
        createdBy,
      });

      const savedStep = await queryRunner.manager.save(step);
      steps.push(savedStep);
    }

    return steps;
  }

  private async validateWorkflowRequest(
    tenantId: string,
    request: CreateWorkflowRequest,
  ): Promise<void> {
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('Nama workflow tidak boleh kosong');
    }

    if (request.name.length > 100) {
      throw new BadRequestException('Nama workflow tidak boleh lebih dari 100 karakter');
    }

    // Validate owner exists if specified
    if (request.ownerId) {
      const owner = await this.userRepository.findOne({
        where: { id: request.ownerId, tenantId },
      });
      if (!owner) {
        throw new BadRequestException('Owner tidak ditemukan');
      }
    }
  }

  private validateStepRequest(request: CreateWorkflowStepRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('Nama step tidak boleh kosong');
    }

    if (request.executionOrder < 0) {
      throw new BadRequestException('Execution order harus >= 0');
    }

    if (request.timeoutSeconds && request.timeoutSeconds <= 0) {
      throw new BadRequestException('Timeout harus > 0 jika diset');
    }
  }

  private async checkNameConflict(
    tenantId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existingWorkflow = await this.workflowRepository.findOne({
      where: { 
        tenantId, 
        name, 
        deletedAt: null,
        ...(excludeId && { id: { $ne: excludeId } as any }),
      },
    });

    if (existingWorkflow) {
      throw new ConflictException(`Workflow dengan nama "${name}" sudah ada`);
    }
  }

  private checkUnreachableSteps(steps: WorkflowStep[], warnings: string[]): void {
    // Simple reachability check - in a full implementation this would be more sophisticated
    const stepIds = new Set(steps.map(s => s.id));
    const reachableSteps = new Set<string>();

    // First step is always reachable
    if (steps.length > 0) {
      const firstStep = steps.sort((a, b) => a.executionOrder - b.executionOrder)[0];
      reachableSteps.add(firstStep.id);
    }

    // Check for condition steps that might make other steps unreachable
    for (const step of steps) {
      if (step.stepType === WorkflowStepType.CONDITION && step.stepConfig?.condition) {
        const trueStepId = step.stepConfig.condition.trueStepId;
        const falseStepId = step.stepConfig.condition.falseStepId;
        
        if (trueStepId && !stepIds.has(trueStepId)) {
          warnings.push(`Step "${step.name}" merujuk ke true step ID yang tidak ada: ${trueStepId}`);
        }
        
        if (falseStepId && !stepIds.has(falseStepId)) {
          warnings.push(`Step "${step.name}" merujuk ke false step ID yang tidak ada: ${falseStepId}`);
        }
      }
    }
  }

  private generatePerformanceSuggestions(workflow: Workflow, suggestions: string[]): void {
    if (workflow.steps && workflow.steps.length > 10) {
      suggestions.push('Workflow dengan banyak step mungkin memerlukan optimasi untuk performa yang lebih baik');
    }

    const apiSteps = workflow.steps?.filter(s => s.stepType === WorkflowStepType.API_CALL) || [];
    if (apiSteps.length > 5) {
      suggestions.push('Pertimbangkan untuk menggabungkan beberapa API call untuk mengurangi latency');
    }

    const parallelizableSteps = workflow.steps?.filter(s => 
      [WorkflowStepType.SEND_EMAIL, WorkflowStepType.SEND_SMS, WorkflowStepType.API_CALL].includes(s.stepType)
    ) || [];
    
    if (parallelizableSteps.length > 2) {
      suggestions.push('Beberapa step bisa dijalankan secara parallel untuk meningkatkan performa');
    }
  }

  private validateTriggerConfiguration(workflow: Workflow, errors: string[], warnings: string[]): void {
    if (workflow.triggerType === WorkflowTriggerType.SCHEDULED) {
      if (!workflow.triggerConfig?.cronExpression) {
        errors.push('Cron expression diperlukan untuk scheduled trigger');
      }
    }

    if (workflow.triggerType === WorkflowTriggerType.WEBHOOK) {
      if (!workflow.triggerConfig?.webhookUrl) {
        warnings.push('Webhook URL belum dikonfigurasi');
      }
    }
  }

  private generateTestScenarios(tenantId: string, workflowId: string): any[] {
    // Generate basic test scenarios based on workflow configuration
    return [
      {
        name: 'Happy Path Test',
        description: 'Test dengan data valid dan kondisi normal',
        inputData: {},
      },
      {
        name: 'Error Handling Test',
        description: 'Test penanganan error dengan data tidak valid',
        inputData: { simulateError: true },
      },
      {
        name: 'Performance Test',
        description: 'Test performa dengan volume data besar',
        inputData: { largeDataset: true },
      },
    ];
  }

  private async estimateExecutionTime(tenantId: string, workflowId: string): Promise<number> {
    const workflow = await this.getWorkflowWithSteps(tenantId, workflowId);
    
    // Simple estimation based on step types and historical data
    let estimatedMs = 0;
    
    for (const step of workflow.steps || []) {
      switch (step.stepType) {
        case WorkflowStepType.API_CALL:
          estimatedMs += 2000; // 2 seconds per API call
          break;
        case WorkflowStepType.DATABASE_QUERY:
          estimatedMs += 500; // 0.5 seconds per query
          break;
        case WorkflowStepType.SEND_EMAIL:
          estimatedMs += 1000; // 1 second per email
          break;
        case WorkflowStepType.DATA_TRANSFORM:
          estimatedMs += 300; // 0.3 seconds per transformation
          break;
        case WorkflowStepType.DELAY:
          if (step.stepConfig?.delay?.duration) {
            estimatedMs += step.stepConfig.delay.duration;
          }
          break;
        default:
          estimatedMs += 100; // 0.1 seconds for other steps
      }
    }
    
    return estimatedMs;
  }

  private async estimateResourceRequirements(tenantId: string, workflowId: string): Promise<any> {
    const workflow = await this.getWorkflowWithSteps(tenantId, workflowId);
    
    return {
      estimatedMemoryMB: (workflow.steps?.length || 0) * 10 + 50, // Base + per step
      estimatedCpuPercent: Math.min((workflow.steps?.length || 0) * 5 + 10, 80),
      estimatedDiskSpaceMB: (workflow.steps?.length || 0) * 5 + 10,
      networkRequirements: {
        apiCalls: workflow.steps?.filter(s => s.stepType === WorkflowStepType.API_CALL).length || 0,
        webhooks: workflow.steps?.filter(s => s.stepType === WorkflowStepType.SEND_WEBHOOK).length || 0,
      },
    };
  }

  private async updateWorkflowStepsCount(workflowId: string): Promise<void> {
    const stepCount = await this.workflowStepRepository.count({
      where: { workflowId, deletedAt: null },
    });

    await this.workflowRepository.update(workflowId, {
      totalStepsExecuted: stepCount,
    });
  }

  private async getWorkflowTemplate(templateId: string): Promise<WorkflowTemplate | null> {
    // This would fetch from a templates repository or predefined templates
    // For now, return null to indicate template not found
    return null;
  }

  private async clearWorkflowCache(tenantId: string, workflowId?: string): Promise<void> {
    if (workflowId) {
      await this.cacheManager.del(`${this.cachePrefix}:workflow:${tenantId}:${workflowId}`);
    }
    
    // Clear list caches
    await this.cacheManager.del(`${this.cachePrefix}:workflows:${tenantId}`);
  }
}