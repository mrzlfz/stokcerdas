import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, TreeRepository } from 'typeorm';
import { Company, CompanyType, CompanyStatus } from '../entities/company.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: TreeRepository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Create a new company
  async create(
    createCompanyData: Partial<Company>,
    tenantId: string,
    createdById: string,
  ): Promise<Company> {
    // Check if company code already exists for this tenant
    const existingCompany = await this.companyRepository.findOne({
      where: {
        tenantId,
        code: createCompanyData.code,
        isDeleted: false,
      },
    });

    if (existingCompany) {
      throw new ConflictException(`Company dengan kode '${createCompanyData.code}' sudah ada`);
    }

    // Validate parent company if specified
    let parentCompany: Company | null = null;
    if (createCompanyData.parentCompanyId) {
      parentCompany = await this.findByIdAndTenant(createCompanyData.parentCompanyId, tenantId);
      if (!parentCompany) {
        throw new NotFoundException(`Parent company tidak ditemukan`);
      }
    }

    // Create the company
    const company = this.companyRepository.create({
      ...createCompanyData,
      tenantId,
      createdBy: createdById,
      updatedBy: createdById,
      parentCompany,
    });

    // Set company level and path
    if (parentCompany) {
      company.level = parentCompany.level + 1;
      company.path = `${parentCompany.path}/${company.code}`;
    } else {
      company.level = 0;
      company.path = company.code;
    }

    // Update company size based on employee count
    if (company.employeeCount) {
      company.updateCompanySize();
    }

    // Validate business hours if provided
    if (company.businessHours && !company.validateBusinessHours()) {
      throw new BadRequestException('Format jam kerja tidak valid');
    }

    const savedCompany = await this.companyRepository.save(company);

    return this.findByIdAndTenant(savedCompany.id, tenantId);
  }

  // Find company by ID and tenant
  async findByIdAndTenant(id: string, tenantId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['parentCompany', 'children', 'ceo', 'financeManager', 'hrManager'],
    });

    if (!company) {
      throw new NotFoundException('Company tidak ditemukan');
    }

    return company;
  }

  // Find company by code and tenant
  async findByCodeAndTenant(code: string, tenantId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { code, tenantId, isDeleted: false },
      relations: ['parentCompany', 'children', 'ceo', 'financeManager', 'hrManager'],
    });

    if (!company) {
      throw new NotFoundException(`Company dengan kode '${code}' tidak ditemukan`);
    }

    return company;
  }

  // Get all companies for a tenant
  async findAllByTenant(
    tenantId: string,
    options?: {
      type?: CompanyType;
      status?: CompanyStatus;
      parentCompanyId?: string;
      includeInactive?: boolean;
    },
  ): Promise<Company[]> {
    const queryBuilder = this.companyRepository
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.parentCompany', 'parentCompany')
      .leftJoinAndSelect('company.children', 'children')
      .leftJoinAndSelect('company.ceo', 'ceo')
      .leftJoinAndSelect('company.financeManager', 'financeManager')
      .leftJoinAndSelect('company.hrManager', 'hrManager')
      .where('company.tenantId = :tenantId', { tenantId })
      .andWhere('company.isDeleted = :isDeleted', { isDeleted: false });

    if (options?.type) {
      queryBuilder.andWhere('company.type = :type', { type: options.type });
    }

    if (options?.status) {
      queryBuilder.andWhere('company.status = :status', { status: options.status });
    }

    if (options?.parentCompanyId) {
      queryBuilder.andWhere('company.parentCompanyId = :parentCompanyId', { 
        parentCompanyId: options.parentCompanyId 
      });
    }

    if (!options?.includeInactive) {
      queryBuilder.andWhere('company.isActive = :isActive', { isActive: true });
    }

    queryBuilder.orderBy('company.level', 'ASC')
             .addOrderBy('company.name', 'ASC');

    return queryBuilder.getMany();
  }

  // Get company hierarchy tree
  async getCompanyTree(tenantId: string, rootCompanyId?: string): Promise<Company[]> {
    if (rootCompanyId) {
      const rootCompany = await this.findByIdAndTenant(rootCompanyId, tenantId);
      return this.companyRepository.findDescendantsTree(rootCompany);
    }

    // Get all root companies (companies without parent)
    const rootCompanies = await this.companyRepository.find({
      where: {
        tenantId,
        parentCompanyId: null,
        isDeleted: false,
      },
      relations: ['children'],
    });

    const trees = [];
    for (const rootCompany of rootCompanies) {
      const tree = await this.companyRepository.findDescendantsTree(rootCompany);
      trees.push(tree);
    }

    return trees;
  }

  // Get company ancestors
  async getCompanyAncestors(companyId: string, tenantId: string): Promise<Company[]> {
    const company = await this.findByIdAndTenant(companyId, tenantId);
    return this.companyRepository.findAncestors(company);
  }

  // Get company descendants
  async getCompanyDescendants(companyId: string, tenantId: string): Promise<Company[]> {
    const company = await this.findByIdAndTenant(companyId, tenantId);
    return this.companyRepository.findDescendants(company);
  }

  // Update company
  async update(
    id: string,
    updateData: Partial<Company>,
    tenantId: string,
    updatedById: string,
  ): Promise<Company> {
    const company = await this.findByIdAndTenant(id, tenantId);

    // Check if code is being changed and if it conflicts
    if (updateData.code && updateData.code !== company.code) {
      const existingCompany = await this.companyRepository.findOne({
        where: {
          tenantId,
          code: updateData.code,
          isDeleted: false,
        },
      });

      if (existingCompany && existingCompany.id !== id) {
        throw new ConflictException(`Company dengan kode '${updateData.code}' sudah ada`);
      }
    }

    // Handle parent company change
    if (updateData.parentCompanyId !== undefined) {
      if (updateData.parentCompanyId) {
        // Validate new parent
        const newParent = await this.findByIdAndTenant(updateData.parentCompanyId, tenantId);
        
        // Check for circular reference
        const descendants = await this.getCompanyDescendants(id, tenantId);
        const descendantIds = descendants.map(d => d.id);
        if (descendantIds.includes(updateData.parentCompanyId)) {
          throw new BadRequestException('Tidak dapat menjadikan anak perusahaan sebagai parent');
        }

        company.parentCompany = newParent;
        company.level = newParent.level + 1;
        company.path = `${newParent.path}/${company.code}`;
      } else {
        // Remove parent (make it root)
        company.parentCompany = null;
        company.parentCompanyId = null;
        company.level = 0;
        company.path = company.code;
      }
    }

    // Update basic fields
    Object.assign(company, updateData, {
      updatedBy: updatedById,
      updatedAt: new Date(),
    });

    // Update company size if employee count changed
    if (updateData.employeeCount !== undefined) {
      company.updateCompanySize();
    }

    // Validate business hours if changed
    if (updateData.businessHours && !company.validateBusinessHours()) {
      throw new BadRequestException('Format jam kerja tidak valid');
    }

    const savedCompany = await this.companyRepository.save(company);

    // Update path for all descendants if path changed
    if (updateData.code || updateData.parentCompanyId !== undefined) {
      await this.updateDescendantPaths(savedCompany, tenantId);
    }

    return this.findByIdAndTenant(savedCompany.id, tenantId);
  }

  // Update paths for all descendants
  private async updateDescendantPaths(company: Company, tenantId: string): Promise<void> {
    const descendants = await this.getCompanyDescendants(company.id, tenantId);
    
    for (const descendant of descendants) {
      if (descendant.id === company.id) continue; // Skip self
      
      // Find the correct parent path
      const ancestors = await this.getCompanyAncestors(descendant.id, tenantId);
      const pathSegments = ancestors
        .filter(a => a.id !== descendant.id)
        .reverse()
        .map(a => a.code);
      pathSegments.push(descendant.code);
      
      descendant.path = pathSegments.join('/');
      await this.companyRepository.save(descendant);
    }
  }

  // Soft delete company
  async softDelete(id: string, tenantId: string, deletedById: string): Promise<void> {
    const company = await this.findByIdAndTenant(id, tenantId);

    // Check if company has children
    const children = await this.companyRepository.find({
      where: {
        parentCompanyId: id,
        tenantId,
        isDeleted: false,
      },
    });

    if (children.length > 0) {
      throw new BadRequestException('Tidak dapat menghapus company yang masih memiliki anak perusahaan');
    }

    company.softDelete(deletedById);
    await this.companyRepository.save(company);
  }

  // Restore soft deleted company
  async restore(id: string, tenantId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id, tenantId, isDeleted: true },
    });

    if (!company) {
      throw new NotFoundException('Company yang dihapus tidak ditemukan');
    }

    company.isDeleted = false;
    company.deletedAt = null;
    company.deletedBy = null;

    await this.companyRepository.save(company);
    return this.findByIdAndTenant(id, tenantId);
  }

  // Activate company
  async activate(id: string, tenantId: string, updatedById: string): Promise<Company> {
    const company = await this.findByIdAndTenant(id, tenantId);
    company.activate();
    company.updatedBy = updatedById;
    await this.companyRepository.save(company);
    return company;
  }

  // Deactivate company
  async deactivate(id: string, tenantId: string, updatedById: string): Promise<Company> {
    const company = await this.findByIdAndTenant(id, tenantId);
    company.deactivate();
    company.updatedBy = updatedById;
    await this.companyRepository.save(company);
    return company;
  }

  // Suspend company
  async suspend(id: string, tenantId: string, reason: string, updatedById: string): Promise<Company> {
    const company = await this.findByIdAndTenant(id, tenantId);
    company.suspend(reason);
    company.updatedBy = updatedById;
    await this.companyRepository.save(company);
    return company;
  }

  // Dissolve company
  async dissolve(id: string, tenantId: string, reason: string, updatedById: string): Promise<Company> {
    const company = await this.findByIdAndTenant(id, tenantId);
    
    // Check if company has active children
    const activeChildren = await this.companyRepository.find({
      where: {
        parentCompanyId: id,
        tenantId,
        status: CompanyStatus.ACTIVE,
        isDeleted: false,
      },
    });

    if (activeChildren.length > 0) {
      throw new BadRequestException('Tidak dapat membubarkan company yang masih memiliki anak perusahaan aktif');
    }

    company.dissolve(reason);
    company.updatedBy = updatedById;
    await this.companyRepository.save(company);
    return company;
  }

  // Assign CEO
  async assignCeo(companyId: string, ceoId: string, tenantId: string, updatedById: string): Promise<Company> {
    const company = await this.findByIdAndTenant(companyId, tenantId);
    
    const ceo = await this.userRepository.findOne({
      where: { id: ceoId, tenantId, isDeleted: false },
    });

    if (!ceo) {
      throw new NotFoundException('User untuk CEO tidak ditemukan');
    }

    company.ceoId = ceoId;
    company.ceo = ceo;
    company.updatedBy = updatedById;
    
    await this.companyRepository.save(company);
    return company;
  }

  // Assign Finance Manager
  async assignFinanceManager(companyId: string, managerId: string, tenantId: string, updatedById: string): Promise<Company> {
    const company = await this.findByIdAndTenant(companyId, tenantId);
    
    const manager = await this.userRepository.findOne({
      where: { id: managerId, tenantId, isDeleted: false },
    });

    if (!manager) {
      throw new NotFoundException('User untuk Finance Manager tidak ditemukan');
    }

    company.financeManagerId = managerId;
    company.financeManager = manager;
    company.updatedBy = updatedById;
    
    await this.companyRepository.save(company);
    return company;
  }

  // Assign HR Manager
  async assignHrManager(companyId: string, managerId: string, tenantId: string, updatedById: string): Promise<Company> {
    const company = await this.findByIdAndTenant(companyId, tenantId);
    
    const manager = await this.userRepository.findOne({
      where: { id: managerId, tenantId, isDeleted: false },
    });

    if (!manager) {
      throw new NotFoundException('User untuk HR Manager tidak ditemukan');
    }

    company.hrManagerId = managerId;
    company.hrManager = manager;
    company.updatedBy = updatedById;
    
    await this.companyRepository.save(company);
    return company;
  }

  // Get companies by type
  async findByType(type: CompanyType, tenantId: string): Promise<Company[]> {
    return this.companyRepository.find({
      where: {
        type,
        tenantId,
        isDeleted: false,
      },
      relations: ['parentCompany', 'children'],
      order: { name: 'ASC' },
    });
  }

  // Get holding companies
  async getHoldingCompanies(tenantId: string): Promise<Company[]> {
    return this.companyRepository.find({
      where: [
        { type: CompanyType.HOLDING, tenantId, isDeleted: false },
        { isHoldingCompany: true, tenantId, isDeleted: false },
      ],
      relations: ['children'],
      order: { name: 'ASC' },
    });
  }

  // Get subsidiaries of a holding company
  async getSubsidiaries(holdingCompanyId: string, tenantId: string): Promise<Company[]> {
    const holdingCompany = await this.findByIdAndTenant(holdingCompanyId, tenantId);
    
    if (!holdingCompany.isHolding()) {
      throw new BadRequestException('Company bukan holding company');
    }

    return this.getCompanyDescendants(holdingCompanyId, tenantId);
  }

  // Check if companies can transfer to each other
  async canTransfer(fromCompanyId: string, toCompanyId: string, tenantId: string): Promise<boolean> {
    const fromCompany = await this.findByIdAndTenant(fromCompanyId, tenantId);
    const toCompany = await this.findByIdAndTenant(toCompanyId, tenantId);

    return fromCompany.canTransferToCompany(toCompany);
  }

  // Get company statistics
  async getCompanyStatistics(tenantId: string): Promise<{
    totalCompanies: number;
    activeCompanies: number;
    holdingCompanies: number;
    subsidiaries: number;
    totalEmployees: number;
    companiesByType: Record<string, number>;
    companiesByStatus: Record<string, number>;
  }> {
    const companies = await this.companyRepository.find({
      where: { tenantId, isDeleted: false },
    });

    const totalEmployees = companies.reduce((sum, company) => {
      return sum + (company.employeeCount || 0);
    }, 0);

    const companiesByType = companies.reduce((acc, company) => {
      acc[company.type] = (acc[company.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const companiesByStatus = companies.reduce((acc, company) => {
      acc[company.status] = (acc[company.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCompanies: companies.length,
      activeCompanies: companies.filter(c => c.isActive()).length,
      holdingCompanies: companies.filter(c => c.isHolding()).length,
      subsidiaries: companies.filter(c => c.isSubsidiary()).length,
      totalEmployees,
      companiesByType,
      companiesByStatus,
    };
  }

  // Search companies
  async searchCompanies(
    searchTerm: string,
    tenantId: string,
    options?: {
      type?: CompanyType;
      status?: CompanyStatus;
      limit?: number;
    },
  ): Promise<Company[]> {
    const queryBuilder = this.companyRepository
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.parentCompany', 'parentCompany')
      .where('company.tenantId = :tenantId', { tenantId })
      .andWhere('company.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        '(LOWER(company.name) LIKE LOWER(:searchTerm) OR ' +
        'LOWER(company.code) LIKE LOWER(:searchTerm) OR ' +
        'LOWER(company.legalName) LIKE LOWER(:searchTerm))',
        { searchTerm: `%${searchTerm}%` }
      );

    if (options?.type) {
      queryBuilder.andWhere('company.type = :type', { type: options.type });
    }

    if (options?.status) {
      queryBuilder.andWhere('company.status = :status', { status: options.status });
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    queryBuilder.orderBy('company.name', 'ASC');

    return queryBuilder.getMany();
  }

  // Bulk update companies
  async bulkUpdate(
    companyIds: string[],
    updateData: Partial<Company>,
    tenantId: string,
    updatedById: string,
  ): Promise<Company[]> {
    const companies = await Promise.all(
      companyIds.map(id => this.findByIdAndTenant(id, tenantId))
    );

    const updatedCompanies = [];
    for (const company of companies) {
      const updated = await this.update(company.id, updateData, tenantId, updatedById);
      updatedCompanies.push(updated);
    }

    return updatedCompanies;
  }

  // Get companies that allow inter-company transfers
  async getTransferEnabledCompanies(tenantId: string): Promise<Company[]> {
    return this.companyRepository.find({
      where: {
        tenantId,
        isDeleted: false,
        allowsInterCompanyTransfers: true,
        status: CompanyStatus.ACTIVE,
      },
      order: { name: 'ASC' },
    });
  }

  // Get companies that require approval for transfers
  async getApprovalRequiredCompanies(tenantId: string): Promise<Company[]> {
    return this.companyRepository.find({
      where: {
        tenantId,
        isDeleted: false,
        requiresApprovalForTransfers: true,
      },
      order: { name: 'ASC' },
    });
  }

  // Update company performance metrics
  async updatePerformanceMetrics(
    companyId: string,
    metrics: Partial<Company['performanceMetrics']>,
    tenantId: string,
  ): Promise<Company> {
    const company = await this.findByIdAndTenant(companyId, tenantId);
    company.updatePerformanceMetrics(metrics);
    await this.companyRepository.save(company);
    return company;
  }

  // Check company setup completeness
  async checkSetupCompleteness(companyId: string, tenantId: string): Promise<{
    isComplete: boolean;
    completionPercentage: number;
    missingItems: string[];
  }> {
    const company = await this.findByIdAndTenant(companyId, tenantId);
    
    const checks = [
      { key: 'basicInfo', check: () => !!(company.name && company.code && company.description) },
      { key: 'contactInfo', check: () => company.isContactInfoComplete() },
      { key: 'financialInfo', check: () => company.isFinancialDataComplete() },
      { key: 'management', check: () => !!(company.ceoId) },
      { key: 'address', check: () => !!(company.addressLine1 && company.city && company.province) },
      { key: 'businessSettings', check: () => !!(company.businessSettings) },
    ];

    const completed = checks.filter(check => check.check());
    const completionPercentage = Math.round((completed.length / checks.length) * 100);
    const missingItems = checks.filter(check => !check.check()).map(check => check.key);

    return {
      isComplete: company.isSetupComplete(),
      completionPercentage,
      missingItems,
    };
  }
}