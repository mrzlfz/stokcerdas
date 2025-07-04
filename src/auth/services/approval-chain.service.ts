import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApprovalChain,
  ApprovalType,
  ApprovalStatus,
  ApprovalMode,
  EscalationTrigger,
} from '../entities/approval-chain.entity';
import { ApprovalStep } from '../entities/approval-chain.entity';
import { HierarchicalRole } from '../entities/hierarchical-role.entity';
import { Department } from '../entities/department.entity';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  requesterId: string;
  requestData: any;
  context: {
    amount?: number;
    department?: string;
    role?: string;
    [key: string]: any;
  };
  submittedAt: Date;
}

export interface ApprovalExecution {
  id: string;
  chainId: string;
  requestId: string;
  currentStepOrder: number;
  status: 'pending' | 'approved' | 'rejected' | 'timeout' | 'escalated';
  startedAt: Date;
  completedAt?: Date;
  totalTimeHours?: number;
  stepExecutions: StepExecution[];
}

export interface StepExecution {
  stepId: string;
  stepOrder: number;
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'skipped'
    | 'timeout'
    | 'escalated';
  approverId?: string;
  approvedAt?: Date;
  comments?: string;
  timeoutAt?: Date;
  isEscalated: boolean;
  escalatedTo?: string;
}

@Injectable()
export class ApprovalChainService {
  constructor(
    @InjectRepository(ApprovalChain)
    private approvalChainRepository: Repository<ApprovalChain>,
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(HierarchicalRole)
    private roleRepository: Repository<HierarchicalRole>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
  ) {}

  // Create approval chain
  async create(
    createChainDto: any,
    tenantId: string,
    userId: string,
  ): Promise<ApprovalChain> {
    const { steps, ...chainData } = createChainDto;

    // Check if code is unique within tenant
    const existingChain = await this.approvalChainRepository.findOne({
      where: {
        tenantId,
        code: chainData.code,
        isDeleted: false,
      },
    });

    if (existingChain) {
      throw new BadRequestException('Kode approval chain sudah ada');
    }

    // Validate department if provided
    if (chainData.departmentId) {
      const department = await this.departmentRepository.findOne({
        where: {
          id: chainData.departmentId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!department) {
        throw new BadRequestException('Departemen tidak ditemukan');
      }
    }

    // Validate escalation role if provided
    if (chainData.escalationRoleId) {
      const escalationRole = await this.roleRepository.findOne({
        where: {
          id: chainData.escalationRoleId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!escalationRole) {
        throw new BadRequestException('Escalation role tidak ditemukan');
      }
    }

    const chain = this.approvalChainRepository.create({
      ...chainData,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedChain = (await this.approvalChainRepository.save(
      chain,
    )) as unknown as ApprovalChain;

    // Create steps if provided
    if (steps && steps.length > 0) {
      await this.addSteps(savedChain.id, steps, tenantId, userId);
    }

    return this.findById(savedChain.id, tenantId);
  }

  // Find approval chain by ID
  async findById(id: string, tenantId: string): Promise<ApprovalChain> {
    const chain = await this.approvalChainRepository.findOne({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
      relations: ['steps', 'department', 'escalationRole'],
    });

    if (!chain) {
      throw new NotFoundException('Approval chain tidak ditemukan');
    }

    return chain;
  }

  // Find all approval chains for a tenant
  async findAll(
    tenantId: string,
    includeInactive = false,
    type?: ApprovalType,
  ): Promise<ApprovalChain[]> {
    const queryBuilder = this.approvalChainRepository
      .createQueryBuilder('chain')
      .leftJoinAndSelect('chain.steps', 'steps')
      .leftJoinAndSelect('chain.department', 'department')
      .leftJoinAndSelect('chain.escalationRole', 'escalationRole')
      .leftJoinAndSelect('steps.approverRole', 'approverRole')
      .leftJoinAndSelect('steps.escalationRole', 'stepEscalationRole')
      .where('chain.tenantId = :tenantId', { tenantId })
      .andWhere('chain.isDeleted = false');

    if (!includeInactive) {
      queryBuilder.andWhere('chain.status = :status', {
        status: ApprovalStatus.ACTIVE,
      });
    }

    if (type) {
      queryBuilder.andWhere('chain.type = :type', { type });
    }

    queryBuilder
      .orderBy('chain.name', 'ASC')
      .addOrderBy('steps.stepOrder', 'ASC');

    return queryBuilder.getMany();
  }

  // Get approval chains by type
  async findByType(
    type: ApprovalType,
    tenantId: string,
  ): Promise<ApprovalChain[]> {
    return this.approvalChainRepository.find({
      where: {
        tenantId,
        type,
        isDeleted: false,
        status: ApprovalStatus.ACTIVE,
      },
      relations: ['steps', 'department', 'escalationRole'],
      order: {
        name: 'ASC',
        steps: { stepOrder: 'ASC' },
      },
    });
  }

  // Get approval chains by department
  async findByDepartment(
    departmentId: string,
    tenantId: string,
  ): Promise<ApprovalChain[]> {
    return this.approvalChainRepository.find({
      where: {
        tenantId,
        departmentId,
        isDeleted: false,
        status: ApprovalStatus.ACTIVE,
      },
      relations: ['steps', 'department', 'escalationRole'],
      order: {
        name: 'ASC',
      },
    });
  }

  // Search approval chains
  async search(
    query: string,
    tenantId: string,
    limit = 20,
  ): Promise<ApprovalChain[]> {
    return this.approvalChainRepository
      .createQueryBuilder('chain')
      .leftJoinAndSelect('chain.steps', 'steps')
      .leftJoinAndSelect('chain.department', 'department')
      .where('chain.tenantId = :tenantId', { tenantId })
      .andWhere('chain.isDeleted = false')
      .andWhere('chain.status = :status', { status: ApprovalStatus.ACTIVE })
      .andWhere(
        '(chain.name ILIKE :query OR chain.code ILIKE :query OR chain.description ILIKE :query)',
        {
          query: `%${query}%`,
        },
      )
      .orderBy('chain.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  // Update approval chain
  async update(
    id: string,
    updateChainDto: any,
    tenantId: string,
    userId: string,
  ): Promise<ApprovalChain> {
    const chain = await this.findById(id, tenantId);

    if (chain.isSystemDefined) {
      throw new ForbiddenException(
        'Approval chain sistem tidak dapat dimodifikasi',
      );
    }

    const { steps, ...updateData } = updateChainDto;

    Object.assign(chain, updateData);
    chain.updatedBy = userId;

    const savedChain = await this.approvalChainRepository.save(chain);

    // Update steps if provided
    if (steps !== undefined) {
      await this.replaceSteps(id, steps, tenantId, userId);
    }

    return this.findById(savedChain.id, tenantId);
  }

  // Add steps to approval chain
  async addSteps(
    chainId: string,
    steps: any[],
    tenantId: string,
    userId: string,
  ): Promise<ApprovalStep[]> {
    const chain = await this.findById(chainId, tenantId);

    if (chain.isSystemDefined) {
      throw new ForbiddenException(
        'Approval chain sistem tidak dapat dimodifikasi',
      );
    }

    const createdSteps: ApprovalStep[] = [];

    for (const stepData of steps) {
      // Validate approver role if provided
      if (stepData.approverRoleId) {
        const approverRole = await this.roleRepository.findOne({
          where: {
            id: stepData.approverRoleId,
            tenantId,
            isDeleted: false,
          },
        });

        if (!approverRole) {
          throw new BadRequestException(
            `Approver role tidak ditemukan untuk step ${stepData.stepOrder}`,
          );
        }
      }

      // Validate escalation role if provided
      if (stepData.escalationRoleId) {
        const escalationRole = await this.roleRepository.findOne({
          where: {
            id: stepData.escalationRoleId,
            tenantId,
            isDeleted: false,
          },
        });

        if (!escalationRole) {
          throw new BadRequestException(
            `Escalation role tidak ditemukan untuk step ${stepData.stepOrder}`,
          );
        }
      }

      const step = this.approvalStepRepository.create({
        ...stepData,
        approvalChainId: chainId,
        tenantId,
        createdBy: userId,
        updatedBy: userId,
      });

      const savedStep = (await this.approvalStepRepository.save(
        step,
      )) as unknown as ApprovalStep;
      createdSteps.push(savedStep);
    }

    return createdSteps;
  }

  // Replace all steps in approval chain
  async replaceSteps(
    chainId: string,
    steps: any[],
    tenantId: string,
    userId: string,
  ): Promise<ApprovalStep[]> {
    const chain = await this.findById(chainId, tenantId);

    if (chain.isSystemDefined) {
      throw new ForbiddenException(
        'Approval chain sistem tidak dapat dimodifikasi',
      );
    }

    // Remove existing steps
    await this.approvalStepRepository.delete({
      approvalChainId: chainId,
      tenantId,
    });

    // Add new steps
    return this.addSteps(chainId, steps, tenantId, userId);
  }

  // Change approval chain status
  async changeStatus(
    id: string,
    status: ApprovalStatus,
    tenantId: string,
    userId: string,
  ): Promise<ApprovalChain> {
    const chain = await this.findById(id, tenantId);

    if (chain.isSystemDefined) {
      throw new ForbiddenException(
        'Approval chain sistem tidak dapat dimodifikasi',
      );
    }

    chain.status = status;
    chain.updatedBy = userId;

    return this.approvalChainRepository.save(chain);
  }

  // Soft delete approval chain
  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const chain = await this.findById(id, tenantId);

    if (chain.isSystemDefined) {
      throw new BadRequestException(
        'Approval chain sistem tidak dapat dihapus',
      );
    }

    // Check if chain is being used
    if (chain.usageCount > 0) {
      throw new BadRequestException(
        'Approval chain masih digunakan dan tidak dapat dihapus',
      );
    }

    chain.softDelete(userId);
    await this.approvalChainRepository.save(chain);
  }

  // Execute approval workflow
  async executeApproval(
    request: ApprovalRequest,
    tenantId: string,
  ): Promise<ApprovalExecution> {
    // Find appropriate approval chain
    const chain = await this.findApprovalChain(
      request.type,
      request.context,
      tenantId,
    );

    if (!chain) {
      throw new NotFoundException(
        'Tidak ada approval chain yang sesuai untuk request ini',
      );
    }

    // Validate chain configuration
    if (!chain.isValidConfiguration()) {
      throw new BadRequestException('Konfigurasi approval chain tidak valid');
    }

    // Create execution
    const execution: ApprovalExecution = {
      id: this.generateExecutionId(),
      chainId: chain.id,
      requestId: request.id,
      currentStepOrder: 1,
      status: 'pending',
      startedAt: new Date(),
      stepExecutions: [],
    };

    // Initialize step executions
    const sortedSteps = chain.sortedSteps;
    for (const step of sortedSteps) {
      const stepExecution: StepExecution = {
        stepId: step.id,
        stepOrder: step.stepOrder,
        status: 'pending',
        isEscalated: false,
      };

      // Check if step should be skipped
      if (step.shouldSkip(request.context)) {
        stepExecution.status = 'skipped';
      }

      // Check if step should be auto-approved
      if (step.shouldAutoApprove(request.context)) {
        stepExecution.status = 'approved';
        stepExecution.approvedAt = new Date();
        stepExecution.comments = 'Auto-approved based on conditions';
      }

      // Set timeout
      if (step.timeoutHours || chain.defaultTimeoutHours) {
        const timeoutHours = step.timeoutHours || chain.defaultTimeoutHours;
        stepExecution.timeoutAt = new Date(
          Date.now() + timeoutHours * 60 * 60 * 1000,
        );
      }

      execution.stepExecutions.push(stepExecution);
    }

    // Update chain usage
    await this.recordUsage(chain.id, true, 0);

    return execution;
  }

  // Process approval response
  async processApprovalResponse(
    executionId: string,
    stepOrder: number,
    approverId: string,
    approved: boolean,
    comments?: string,
    tenantId?: string,
  ): Promise<ApprovalExecution> {
    // This is a simplified implementation
    // In a real system, you would persist and retrieve executions from database
    throw new Error('Method not implemented - requires execution storage');
  }

  // Handle approval timeout
  async handleTimeout(
    executionId: string,
    stepOrder: number,
    tenantId: string,
  ): Promise<ApprovalExecution> {
    // This would handle timeouts and escalations
    throw new Error(
      'Method not implemented - requires execution storage and scheduler',
    );
  }

  // Escalate approval
  async escalateApproval(
    executionId: string,
    stepOrder: number,
    escalationReason: string,
    tenantId: string,
  ): Promise<ApprovalExecution> {
    // This would handle escalation logic
    throw new Error('Method not implemented - requires execution storage');
  }

  // Get approval chain statistics
  async getApprovalChainStats(tenantId: string): Promise<any> {
    const chains = await this.findAll(tenantId, true);

    const stats = {
      total: chains.length,
      active: chains.filter(c => c.status === ApprovalStatus.ACTIVE).length,
      inactive: chains.filter(c => c.status === ApprovalStatus.INACTIVE).length,
      draft: chains.filter(c => c.status === ApprovalStatus.DRAFT).length,
      archived: chains.filter(c => c.status === ApprovalStatus.ARCHIVED).length,
      byType: {
        roleAssignment: chains.filter(
          c => c.type === ApprovalType.ROLE_ASSIGNMENT,
        ).length,
        permissionGrant: chains.filter(
          c => c.type === ApprovalType.PERMISSION_GRANT,
        ).length,
        accessRequest: chains.filter(
          c => c.type === ApprovalType.ACCESS_REQUEST,
        ).length,
        departmentTransfer: chains.filter(
          c => c.type === ApprovalType.DEPARTMENT_TRANSFER,
        ).length,
        systemAccess: chains.filter(c => c.type === ApprovalType.SYSTEM_ACCESS)
          .length,
        dataAccess: chains.filter(c => c.type === ApprovalType.DATA_ACCESS)
          .length,
        budgetApproval: chains.filter(
          c => c.type === ApprovalType.BUDGET_APPROVAL,
        ).length,
        purchaseOrder: chains.filter(
          c => c.type === ApprovalType.PURCHASE_ORDER,
        ).length,
        expenseApproval: chains.filter(
          c => c.type === ApprovalType.EXPENSE_APPROVAL,
        ).length,
        custom: chains.filter(c => c.type === ApprovalType.CUSTOM).length,
      },
      byMode: {
        sequential: chains.filter(c => c.mode === ApprovalMode.SEQUENTIAL)
          .length,
        parallel: chains.filter(c => c.mode === ApprovalMode.PARALLEL).length,
        majority: chains.filter(c => c.mode === ApprovalMode.MAJORITY).length,
        unanimous: chains.filter(c => c.mode === ApprovalMode.UNANIMOUS).length,
        firstResponse: chains.filter(
          c => c.mode === ApprovalMode.FIRST_RESPONSE,
        ).length,
      },
      totalUsage: chains.reduce((sum, chain) => sum + chain.usageCount, 0),
      averageSteps:
        chains.reduce((sum, chain) => sum + chain.stepCount, 0) / chains.length,
      escalationEnabled: chains.filter(c => c.enableEscalation).length,
    };

    return stats;
  }

  // Clone approval chain
  async clone(
    sourceId: string,
    newCode: string,
    newName: string,
    tenantId: string,
    userId: string,
  ): Promise<ApprovalChain> {
    const sourceChain = await this.findById(sourceId, tenantId);

    // Check if new code is unique
    const existingChain = await this.approvalChainRepository.findOne({
      where: {
        tenantId,
        code: newCode,
        isDeleted: false,
      },
    });

    if (existingChain) {
      throw new BadRequestException('Kode approval chain baru sudah ada');
    }

    // Clone chain
    const clonedChain = this.approvalChainRepository.create({
      ...sourceChain,
      id: undefined,
      code: newCode,
      name: newName,
      status: ApprovalStatus.DRAFT,
      isSystemDefined: false,
      usageCount: 0,
      lastUsedAt: null,
      usageStats: null,
      createdBy: userId,
      updatedBy: userId,
      createdAt: undefined,
      updatedAt: undefined,
    });

    const savedChain = await this.approvalChainRepository.save(clonedChain);

    // Clone steps
    if (sourceChain.steps && sourceChain.steps.length > 0) {
      const clonedSteps = sourceChain.steps.map(step => ({
        ...step,
        id: undefined,
        approvalChainId: undefined,
        createdBy: userId,
        updatedBy: userId,
        createdAt: undefined,
        updatedAt: undefined,
      }));

      await this.addSteps(savedChain.id, clonedSteps, tenantId, userId);
    }

    return this.findById(savedChain.id, tenantId);
  }

  // Bulk operations
  async bulkUpdateStatus(
    chainIds: string[],
    status: ApprovalStatus,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.approvalChainRepository
      .createQueryBuilder()
      .update(ApprovalChain)
      .set({
        status,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where('id IN (:...ids)', { ids: chainIds })
      .andWhere('tenantId = :tenantId', { tenantId })
      .andWhere('isDeleted = false')
      .andWhere('isSystemDefined = false') // Prevent system chain modifications
      .execute();
  }

  // Private helper methods
  private async findApprovalChain(
    type: ApprovalType,
    context: any,
    tenantId: string,
  ): Promise<ApprovalChain | null> {
    const chains = await this.findByType(type, tenantId);

    if (chains.length === 0) {
      return null;
    }

    // Find the most specific chain based on context
    let bestMatch: ApprovalChain | null = null;
    let bestScore = -1;

    for (const chain of chains) {
      let score = 0;

      // Department match
      if (chain.departmentId && context.department === chain.departmentId) {
        score += 10;
      } else if (
        chain.departmentId &&
        context.department !== chain.departmentId
      ) {
        continue; // Skip if department doesn't match
      }

      // Conditions match
      if (chain.conditions) {
        // Amount threshold check
        if (chain.conditions.amountThresholds && context.amount) {
          const amount = context.amount;
          if (
            chain.conditions.amountThresholds.step1 &&
            amount >= chain.conditions.amountThresholds.step1
          ) {
            score += 5;
          }
          if (
            chain.conditions.amountThresholds.step2 &&
            amount >= chain.conditions.amountThresholds.step2
          ) {
            score += 3;
          }
          if (
            chain.conditions.amountThresholds.step3 &&
            amount >= chain.conditions.amountThresholds.step3
          ) {
            score += 1;
          }
        }

        // Department rules
        if (chain.conditions.departmentRules && context.department) {
          const deptRules =
            chain.conditions.departmentRules[context.department];
          if (deptRules) {
            score += 8;
          }
        }

        // User rules
        if (chain.conditions.userRules && context.userId) {
          const userRules = chain.conditions.userRules[context.userId];
          if (userRules) {
            score += 6;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = chain;
      }
    }

    return bestMatch || chains[0]; // Return best match or first available
  }

  private async recordUsage(
    chainId: string,
    approved: boolean,
    processingTimeHours: number,
  ): Promise<void> {
    const chain = await this.approvalChainRepository.findOne({
      where: { id: chainId },
    });

    if (chain) {
      chain.updateUsageStats(approved, processingTimeHours);
      await this.approvalChainRepository.save(chain);
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Validation methods
  async validateChainConfiguration(
    chainId: string,
    tenantId: string,
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const chain = await this.findById(chainId, tenantId);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if chain has steps
    if (!chain.steps || chain.steps.length === 0) {
      errors.push('Approval chain harus memiliki minimal satu step');
    }

    // Check step order continuity
    if (chain.steps && chain.steps.length > 0) {
      const orders = chain.steps.map(s => s.stepOrder).sort((a, b) => a - b);
      for (let i = 1; i < orders.length; i++) {
        if (orders[i] !== orders[i - 1] + 1) {
          errors.push(
            `Gap dalam urutan step antara ${orders[i - 1]} dan ${orders[i]}`,
          );
        }
      }
    }

    // Check if all steps have valid approvers
    for (const step of chain.steps || []) {
      if (!step.isValid) {
        errors.push(
          `Step ${step.stepOrder} tidak memiliki approver yang valid`,
        );
      }

      if (step.timeoutHours && step.timeoutHours < 1) {
        warnings.push(
          `Step ${step.stepOrder} memiliki timeout yang sangat singkat (< 1 jam)`,
        );
      }
    }

    // Check escalation configuration
    if (chain.enableEscalation) {
      if (
        !chain.escalationRoleId &&
        !chain.steps?.some(s => s.escalationRoleId)
      ) {
        warnings.push(
          'Escalation diaktifkan tapi tidak ada role escalation yang dikonfigurasi',
        );
      }

      if (!chain.escalationTimeoutHours) {
        warnings.push(
          'Escalation diaktifkan tapi tidak ada timeout escalation yang dikonfigurasi',
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Testing method for approval chains
  async testApprovalChain(
    chainId: string,
    testRequest: ApprovalRequest,
    tenantId: string,
  ): Promise<{
    chainId: string;
    testResult: 'success' | 'error';
    simulatedExecution: Partial<ApprovalExecution>;
    errors?: string[];
  }> {
    try {
      const validation = await this.validateChainConfiguration(
        chainId,
        tenantId,
      );

      if (!validation.isValid) {
        return {
          chainId,
          testResult: 'error',
          simulatedExecution: {},
          errors: validation.errors,
        };
      }

      const execution = await this.executeApproval(testRequest, tenantId);

      return {
        chainId,
        testResult: 'success',
        simulatedExecution: {
          chainId: execution.chainId,
          currentStepOrder: execution.currentStepOrder,
          status: execution.status,
          stepExecutions: execution.stepExecutions.map(se => ({
            stepId: se.stepId || `step-${se.stepOrder}`,
            stepOrder: se.stepOrder,
            status: se.status,
            isEscalated: se.isEscalated,
            timeoutAt: se.timeoutAt,
          })),
        },
      };
    } catch (error) {
      return {
        chainId,
        testResult: 'error',
        simulatedExecution: {},
        errors: [error.message],
      };
    }
  }
}
