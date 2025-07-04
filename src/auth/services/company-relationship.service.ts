import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CompanyRelationship,
  RelationshipType,
  RelationshipStatus,
} from '../entities/company-relationship.entity';
import { Company } from '../entities/company.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class CompanyRelationshipService {
  constructor(
    @InjectRepository(CompanyRelationship)
    private readonly relationshipRepository: Repository<CompanyRelationship>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Create a new company relationship
  async create(
    createRelationshipData: Partial<CompanyRelationship>,
    tenantId: string,
    createdById: string,
  ): Promise<CompanyRelationship> {
    // Validate from and to companies
    const fromCompany = await this.companyRepository.findOne({
      where: {
        id: createRelationshipData.fromCompanyId,
        tenantId,
        isDeleted: false,
      },
    });

    if (!fromCompany) {
      throw new NotFoundException('From company tidak ditemukan');
    }

    const toCompany = await this.companyRepository.findOne({
      where: {
        id: createRelationshipData.toCompanyId,
        tenantId,
        isDeleted: false,
      },
    });

    if (!toCompany) {
      throw new NotFoundException('To company tidak ditemukan');
    }

    // Prevent self-relationship
    if (
      createRelationshipData.fromCompanyId ===
      createRelationshipData.toCompanyId
    ) {
      throw new BadRequestException(
        'Company tidak dapat memiliki relasi dengan dirinya sendiri',
      );
    }

    // Check for existing relationship
    const existingRelationship = await this.relationshipRepository.findOne({
      where: {
        tenantId,
        fromCompanyId: createRelationshipData.fromCompanyId,
        toCompanyId: createRelationshipData.toCompanyId,
        relationshipType: createRelationshipData.relationshipType,
        isDeleted: false,
      },
    });

    if (existingRelationship) {
      throw new ConflictException(
        `Relasi ${createRelationshipData.relationshipType} antara company ini sudah ada`,
      );
    }

    // Create the relationship
    const relationship = this.relationshipRepository.create({
      ...createRelationshipData,
      tenantId,
      createdBy: createdById,
      updatedBy: createdById,
    });

    // Set relationship name if not provided
    if (!relationship.relationshipName) {
      relationship.relationshipName = `${fromCompany.name} - ${toCompany.name}`;
    }

    // Validate business terms
    if (!relationship.validateBusinessTerms()) {
      throw new BadRequestException('Business terms tidak valid');
    }

    const savedRelationship = await this.relationshipRepository.save(
      relationship,
    );
    return this.findByIdAndTenant(savedRelationship.id, tenantId);
  }

  // Find relationship by ID and tenant
  async findByIdAndTenant(
    id: string,
    tenantId: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.relationshipRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: [
        'fromCompany',
        'toCompany',
        'primaryContactFrom',
        'primaryContactTo',
        'relationshipManager',
      ],
    });

    if (!relationship) {
      throw new NotFoundException('Company relationship tidak ditemukan');
    }

    return relationship;
  }

  // Get all relationships for a tenant
  async findAllByTenant(
    tenantId: string,
    options?: {
      relationshipType?: RelationshipType;
      status?: RelationshipStatus;
      fromCompanyId?: string;
      toCompanyId?: string;
      includeInactive?: boolean;
    },
  ): Promise<CompanyRelationship[]> {
    const queryBuilder = this.relationshipRepository
      .createQueryBuilder('relationship')
      .leftJoinAndSelect('relationship.fromCompany', 'fromCompany')
      .leftJoinAndSelect('relationship.toCompany', 'toCompany')
      .leftJoinAndSelect(
        'relationship.primaryContactFrom',
        'primaryContactFrom',
      )
      .leftJoinAndSelect('relationship.primaryContactTo', 'primaryContactTo')
      .leftJoinAndSelect(
        'relationship.relationshipManager',
        'relationshipManager',
      )
      .where('relationship.tenantId = :tenantId', { tenantId })
      .andWhere('relationship.isDeleted = :isDeleted', { isDeleted: false });

    if (options?.relationshipType) {
      queryBuilder.andWhere(
        'relationship.relationshipType = :relationshipType',
        {
          relationshipType: options.relationshipType,
        },
      );
    }

    if (options?.status) {
      queryBuilder.andWhere('relationship.status = :status', {
        status: options.status,
      });
    }

    if (options?.fromCompanyId) {
      queryBuilder.andWhere('relationship.fromCompanyId = :fromCompanyId', {
        fromCompanyId: options.fromCompanyId,
      });
    }

    if (options?.toCompanyId) {
      queryBuilder.andWhere('relationship.toCompanyId = :toCompanyId', {
        toCompanyId: options.toCompanyId,
      });
    }

    if (!options?.includeInactive) {
      queryBuilder.andWhere('relationship.isActive = :isActive', {
        isActive: true,
      });
    }

    queryBuilder.orderBy('relationship.effectiveFrom', 'DESC');

    return queryBuilder.getMany();
  }

  // Get relationships for a specific company
  async findRelationshipsForCompany(
    companyId: string,
    tenantId: string,
  ): Promise<CompanyRelationship[]> {
    return this.relationshipRepository.find({
      where: [
        { fromCompanyId: companyId, tenantId, isDeleted: false },
        { toCompanyId: companyId, tenantId, isDeleted: false },
      ],
      relations: ['fromCompany', 'toCompany', 'relationshipManager'],
      order: { effectiveFrom: 'DESC' },
    });
  }

  // Get parent-subsidiary relationships
  async getParentSubsidiaryRelationships(
    tenantId: string,
  ): Promise<CompanyRelationship[]> {
    return this.findAllByTenant(tenantId, {
      relationshipType: RelationshipType.PARENT_SUBSIDIARY,
      status: RelationshipStatus.ACTIVE,
    });
  }

  // Get business partnerships
  async getBusinessPartnerships(
    tenantId: string,
  ): Promise<CompanyRelationship[]> {
    return this.relationshipRepository.find({
      where: {
        tenantId,
        relationshipType: RelationshipType.PARTNER,
        status: RelationshipStatus.ACTIVE,
        isDeleted: false,
      },
      relations: ['fromCompany', 'toCompany'],
      order: { effectiveFrom: 'DESC' },
    });
  }

  // Get trading relationships (suppliers, customers, distributors)
  async getTradingRelationships(
    tenantId: string,
  ): Promise<CompanyRelationship[]> {
    return this.relationshipRepository
      .createQueryBuilder('relationship')
      .leftJoinAndSelect('relationship.fromCompany', 'fromCompany')
      .leftJoinAndSelect('relationship.toCompany', 'toCompany')
      .where('relationship.tenantId = :tenantId', { tenantId })
      .andWhere('relationship.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('relationship.relationshipType IN (:...types)', {
        types: [
          RelationshipType.SUPPLIER,
          RelationshipType.CUSTOMER,
          RelationshipType.DISTRIBUTOR,
        ],
      })
      .andWhere('relationship.status = :status', {
        status: RelationshipStatus.ACTIVE,
      })
      .orderBy('relationship.effectiveFrom', 'DESC')
      .getMany();
  }

  // Update relationship
  async update(
    id: string,
    updateData: Partial<CompanyRelationship>,
    tenantId: string,
    updatedById: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);

    // Update fields
    Object.assign(relationship, updateData, {
      updatedBy: updatedById,
      updatedAt: new Date(),
    });

    // Validate business terms if changed
    if (updateData.businessTerms && !relationship.validateBusinessTerms()) {
      throw new BadRequestException('Business terms tidak valid');
    }

    await this.relationshipRepository.save(relationship);
    return this.findByIdAndTenant(id, tenantId);
  }

  // Activate relationship
  async activate(
    id: string,
    tenantId: string,
    updatedById: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.activate();
    relationship.updatedBy = updatedById;
    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Deactivate relationship
  async deactivate(
    id: string,
    tenantId: string,
    updatedById: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.deactivate();
    relationship.updatedBy = updatedById;
    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Suspend relationship
  async suspend(
    id: string,
    tenantId: string,
    reason: string,
    updatedById: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.suspend(reason);
    relationship.updatedBy = updatedById;
    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Terminate relationship
  async terminate(
    id: string,
    tenantId: string,
    reason: string,
    updatedById: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.terminate(reason);
    relationship.updatedBy = updatedById;
    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Check if transfer is allowed between companies
  async canTransfer(
    fromCompanyId: string,
    toCompanyId: string,
    tenantId: string,
  ): Promise<boolean> {
    const relationship = await this.relationshipRepository.findOne({
      where: [
        { fromCompanyId, toCompanyId, tenantId, isDeleted: false },
        {
          fromCompanyId: toCompanyId,
          toCompanyId: fromCompanyId,
          tenantId,
          isDeleted: false,
        },
      ],
    });

    return relationship ? relationship.canTransfer() : false;
  }

  // Check if transfer requires approval
  async requiresTransferApproval(
    fromCompanyId: string,
    toCompanyId: string,
    amount: number,
    tenantId: string,
  ): Promise<boolean> {
    const relationship = await this.relationshipRepository.findOne({
      where: [
        { fromCompanyId, toCompanyId, tenantId, isDeleted: false },
        {
          fromCompanyId: toCompanyId,
          toCompanyId: fromCompanyId,
          tenantId,
          isDeleted: false,
        },
      ],
    });

    return relationship ? relationship.requiresTransferApproval(amount) : true;
  }

  // Update performance metrics
  async updatePerformanceMetrics(
    id: string,
    transactionAmount: number,
    tenantId: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.updatePerformanceMetrics(transactionAmount);
    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Calculate relationship health
  async calculateRelationshipHealth(
    id: string,
    tenantId: string,
  ): Promise<number> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    const healthScore = relationship.calculateRelationshipHealth();

    // Update the score in database
    relationship.relationshipScore = healthScore / 20; // Convert to 0-5 scale
    await this.relationshipRepository.save(relationship);

    return healthScore;
  }

  // Get expiring relationships
  async getExpiringRelationships(
    tenantId: string,
    daysAhead: number = 30,
  ): Promise<CompanyRelationship[]> {
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + daysAhead);

    return this.relationshipRepository
      .createQueryBuilder('relationship')
      .leftJoinAndSelect('relationship.fromCompany', 'fromCompany')
      .leftJoinAndSelect('relationship.toCompany', 'toCompany')
      .where('relationship.tenantId = :tenantId', { tenantId })
      .andWhere('relationship.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('relationship.status = :status', {
        status: RelationshipStatus.ACTIVE,
      })
      .andWhere('relationship.effectiveUntil IS NOT NULL')
      .andWhere('relationship.effectiveUntil <= :warningDate', { warningDate })
      .orderBy('relationship.effectiveUntil', 'ASC')
      .getMany();
  }

  // Renew relationship
  async renew(
    id: string,
    tenantId: string,
    months: number,
    updatedById: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.renew(months);
    relationship.updatedBy = updatedById;
    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Set relationship manager
  async setRelationshipManager(
    id: string,
    managerId: string,
    tenantId: string,
    updatedById: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);

    const manager = await this.userRepository.findOne({
      where: { id: managerId, tenantId, isDeleted: false },
    });

    if (!manager) {
      throw new NotFoundException(
        'User untuk relationship manager tidak ditemukan',
      );
    }

    relationship.relationshipManagerId = managerId;
    relationship.relationshipManager = manager;
    relationship.updatedBy = updatedById;

    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Set primary contacts
  async setPrimaryContacts(
    id: string,
    fromContactId: string,
    toContactId: string,
    tenantId: string,
    updatedById: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);

    const fromContact = await this.userRepository.findOne({
      where: { id: fromContactId, tenantId, isDeleted: false },
    });

    if (!fromContact) {
      throw new NotFoundException('From contact tidak ditemukan');
    }

    const toContact = await this.userRepository.findOne({
      where: { id: toContactId, tenantId, isDeleted: false },
    });

    if (!toContact) {
      throw new NotFoundException('To contact tidak ditemukan');
    }

    relationship.primaryContactFromId = fromContactId;
    relationship.primaryContactFrom = fromContact;
    relationship.primaryContactToId = toContactId;
    relationship.primaryContactTo = toContact;
    relationship.updatedBy = updatedById;

    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Update compliance status
  async updateComplianceStatus(
    id: string,
    status: string,
    tenantId: string,
    checkDate?: Date,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.updateComplianceStatus(status, checkDate);
    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Set risk level
  async setRiskLevel(
    id: string,
    level: CompanyRelationship['riskLevel'],
    factors: string[],
    tenantId: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.setRiskLevel(level, factors);
    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Schedule review
  async scheduleReview(
    id: string,
    daysFromNow: number,
    tenantId: string,
  ): Promise<CompanyRelationship> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.scheduleReview(daysFromNow);
    await this.relationshipRepository.save(relationship);
    return relationship;
  }

  // Get relationships due for review
  async getRelationshipsDueForReview(
    tenantId: string,
  ): Promise<CompanyRelationship[]> {
    const today = new Date();

    return this.relationshipRepository
      .createQueryBuilder('relationship')
      .leftJoinAndSelect('relationship.fromCompany', 'fromCompany')
      .leftJoinAndSelect('relationship.toCompany', 'toCompany')
      .where('relationship.tenantId = :tenantId', { tenantId })
      .andWhere('relationship.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('relationship.status = :status', {
        status: RelationshipStatus.ACTIVE,
      })
      .andWhere('relationship.nextReviewDate IS NOT NULL')
      .andWhere('relationship.nextReviewDate <= :today', { today })
      .orderBy('relationship.nextReviewDate', 'ASC')
      .getMany();
  }

  // Soft delete relationship
  async softDelete(
    id: string,
    tenantId: string,
    deletedById: string,
  ): Promise<void> {
    const relationship = await this.findByIdAndTenant(id, tenantId);
    relationship.softDelete(deletedById);
    await this.relationshipRepository.save(relationship);
  }

  // Get relationship statistics
  async getRelationshipStatistics(tenantId: string): Promise<{
    totalRelationships: number;
    activeRelationships: number;
    relationshipsByType: Record<string, number>;
    relationshipsByStatus: Record<string, number>;
    expiringRelationships: number;
    averageRelationshipHealth: number;
  }> {
    const relationships = await this.findAllByTenant(tenantId, {
      includeInactive: true,
    });
    const expiringRelationships = await this.getExpiringRelationships(tenantId);

    const relationshipsByType = relationships.reduce((acc, rel) => {
      acc[rel.relationshipType] = (acc[rel.relationshipType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const relationshipsByStatus = relationships.reduce((acc, rel) => {
      acc[rel.status] = (acc[rel.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const healthScores = relationships
      .filter(
        rel =>
          rel.relationshipScore !== null && rel.relationshipScore !== undefined,
      )
      .map(rel => rel.relationshipScore);

    const averageRelationshipHealth =
      healthScores.length > 0
        ? healthScores.reduce((sum, score) => sum + score, 0) /
          healthScores.length
        : 0;

    return {
      totalRelationships: relationships.length,
      activeRelationships: relationships.filter(rel => rel.isActive).length,
      relationshipsByType,
      relationshipsByStatus,
      expiringRelationships: expiringRelationships.length,
      averageRelationshipHealth:
        Math.round(averageRelationshipHealth * 100) / 100,
    };
  }

  // Search relationships
  async searchRelationships(
    searchTerm: string,
    tenantId: string,
    options?: {
      relationshipType?: RelationshipType;
      status?: RelationshipStatus;
      limit?: number;
    },
  ): Promise<CompanyRelationship[]> {
    const queryBuilder = this.relationshipRepository
      .createQueryBuilder('relationship')
      .leftJoinAndSelect('relationship.fromCompany', 'fromCompany')
      .leftJoinAndSelect('relationship.toCompany', 'toCompany')
      .where('relationship.tenantId = :tenantId', { tenantId })
      .andWhere('relationship.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        '(LOWER(relationship.relationshipName) LIKE LOWER(:searchTerm) OR ' +
          'LOWER(fromCompany.name) LIKE LOWER(:searchTerm) OR ' +
          'LOWER(toCompany.name) LIKE LOWER(:searchTerm))',
        { searchTerm: `%${searchTerm}%` },
      );

    if (options?.relationshipType) {
      queryBuilder.andWhere(
        'relationship.relationshipType = :relationshipType',
        {
          relationshipType: options.relationshipType,
        },
      );
    }

    if (options?.status) {
      queryBuilder.andWhere('relationship.status = :status', {
        status: options.status,
      });
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    queryBuilder.orderBy('relationship.effectiveFrom', 'DESC');

    return queryBuilder.getMany();
  }

  // Bulk update relationships
  async bulkUpdate(
    relationshipIds: string[],
    updateData: Partial<CompanyRelationship>,
    tenantId: string,
    updatedById: string,
  ): Promise<CompanyRelationship[]> {
    const relationships = await Promise.all(
      relationshipIds.map(id => this.findByIdAndTenant(id, tenantId)),
    );

    const updatedRelationships = [];
    for (const relationship of relationships) {
      const updated = await this.update(
        relationship.id,
        updateData,
        tenantId,
        updatedById,
      );
      updatedRelationships.push(updated);
    }

    return updatedRelationships;
  }
}
