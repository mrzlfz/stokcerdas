import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Tree,
  TreeParent,
  TreeChildren,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Department } from './department.entity';

export enum CompanyType {
  HOLDING = 'holding',
  SUBSIDIARY = 'subsidiary',
  DIVISION = 'division',
  BRANCH = 'branch',
  REPRESENTATIVE_OFFICE = 'representative_office',
  JOINT_VENTURE = 'joint_venture',
  PARTNERSHIP = 'partnership',
}

export enum CompanyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  UNDER_REVIEW = 'under_review',
  DISSOLVED = 'dissolved',
}

export enum BusinessType {
  MANUFACTURE = 'manufacture',
  TRADING = 'trading',
  SERVICE = 'service',
  RETAIL = 'retail',
  WHOLESALE = 'wholesale',
  DISTRIBUTION = 'distribution',
  ECOMMERCE = 'ecommerce',
  RESTAURANT = 'restaurant',
  AGRICULTURE = 'agriculture',
  TECHNOLOGY = 'technology',
  LOGISTICS = 'logistics',
  CONSULTING = 'consulting',
  OTHER = 'other',
}

export enum CompanySize {
  MICRO = 'micro', // < 10 employees
  SMALL = 'small', // 10-50 employees
  MEDIUM = 'medium', // 51-250 employees
  LARGE = 'large', // > 250 employees
}

@Entity('companies')
@Tree('closure-table')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'code'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'businessType'])
@Index(['status', 'isActive'])
@Index(['parentCompanyId', 'status'])
export class Company extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  // Basic company information
  @Column({ name: 'name', length: 200 })
  name: string;

  @Column({ name: 'legal_name', length: 200, nullable: true })
  legalName: string;

  @Column({ name: 'code', length: 20 })
  code: string;

  @Column({ name: 'display_name', length: 100, nullable: true })
  displayName: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: CompanyType,
    default: CompanyType.SUBSIDIARY,
  })
  type: CompanyType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.ACTIVE,
  })
  status: CompanyStatus;

  @Column({
    name: 'business_type',
    type: 'enum',
    enum: BusinessType,
    default: BusinessType.TRADING,
  })
  businessType: BusinessType;

  @Column({
    name: 'company_size',
    type: 'enum',
    enum: CompanySize,
    default: CompanySize.SMALL,
  })
  companySize: CompanySize;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  // Hierarchical structure
  @Column({ name: 'parent_company_id', type: 'uuid', nullable: true })
  parentCompanyId: string;

  @TreeParent()
  @ManyToOne(() => Company, company => company.children, { nullable: true })
  @JoinColumn({ name: 'parent_company_id' })
  parentCompany?: Company;

  @TreeChildren()
  @OneToMany(() => Company, company => company.parentCompany)
  children: Company[];

  @Column({ name: 'level', type: 'integer', default: 0 })
  level: number;

  @Column({ name: 'path', type: 'varchar', length: 500, nullable: true })
  path: string;

  // Legal and business information
  @Column({ name: 'tax_id', length: 50, nullable: true })
  taxId: string; // NPWP for Indonesian companies

  @Column({ name: 'business_license', length: 100, nullable: true })
  businessLicense: string; // NIB (Nomor Induk Berusaha)

  @Column({ name: 'siup_number', length: 50, nullable: true })
  siupNumber: string; // Surat Izin Usaha Perdagangan

  @Column({ name: 'tdp_number', length: 50, nullable: true })
  tdpNumber: string; // Tanda Daftar Perusahaan

  @Column({ name: 'nib_number', length: 50, nullable: true })
  nibNumber: string; // Nomor Induk Berusaha

  @Column({ name: 'established_date', type: 'date', nullable: true })
  establishedDate: Date;

  @Column({ name: 'incorporation_date', type: 'date', nullable: true })
  incorporationDate: Date;

  // Contact information
  @Column({ name: 'phone_number', length: 20, nullable: true })
  phoneNumber: string;

  @Column({ name: 'email', length: 255, nullable: true })
  email: string;

  @Column({ name: 'website', length: 255, nullable: true })
  website: string;

  @Column({ name: 'fax_number', length: 20, nullable: true })
  faxNumber: string;

  // Address information
  @Column({ name: 'address_line_1', length: 255, nullable: true })
  addressLine1: string;

  @Column({ name: 'address_line_2', length: 255, nullable: true })
  addressLine2: string;

  @Column({ name: 'city', length: 100, nullable: true })
  city: string;

  @Column({ name: 'province', length: 100, nullable: true })
  province: string;

  @Column({ name: 'postal_code', length: 10, nullable: true })
  postalCode: string;

  @Column({ name: 'country', length: 100, default: 'Indonesia' })
  country: string;

  @Column({ name: 'timezone', length: 50, default: 'Asia/Jakarta' })
  timezone: string;

  // Management information
  @Column({ name: 'ceo_id', type: 'uuid', nullable: true })
  ceoId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ceo_id' })
  ceo: User;

  @Column({ name: 'finance_manager_id', type: 'uuid', nullable: true })
  financeManagerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'finance_manager_id' })
  financeManager: User;

  @Column({ name: 'hr_manager_id', type: 'uuid', nullable: true })
  hrManagerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'hr_manager_id' })
  hrManager: User;

  // Financial information
  @Column({ name: 'currency', length: 3, default: 'IDR' })
  currency: string;

  @Column({
    name: 'initial_capital',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  initialCapital: number;

  @Column({
    name: 'paid_up_capital',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  paidUpCapital: number;

  @Column({
    name: 'authorized_capital',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  authorizedCapital: number;

  @Column({
    name: 'annual_revenue',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  annualRevenue: number;

  @Column({ name: 'fiscal_year_start', type: 'integer', default: 1 })
  fiscalYearStart: number; // Month (1-12)

  @Column({ name: 'fiscal_year_end', type: 'integer', default: 12 })
  fiscalYearEnd: number; // Month (1-12)

  // Operational settings
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_holding_company', type: 'boolean', default: false })
  isHoldingCompany: boolean;

  @Column({
    name: 'allows_inter_company_transfers',
    type: 'boolean',
    default: true,
  })
  allowsInterCompanyTransfers: boolean;

  @Column({
    name: 'requires_approval_for_transfers',
    type: 'boolean',
    default: true,
  })
  requiresApprovalForTransfers: boolean;

  @Column({ name: 'consolidation_enabled', type: 'boolean', default: true })
  consolidationEnabled: boolean;

  @Column({ name: 'separate_billing', type: 'boolean', default: false })
  separateBilling: boolean;

  @Column({ name: 'employee_count', type: 'integer', nullable: true })
  employeeCount: number;

  @Column({ name: 'max_employees', type: 'integer', nullable: true })
  maxEmployees: number;

  // Business hours and operational settings
  @Column({ name: 'business_hours', type: 'jsonb', nullable: true })
  businessHours: {
    monday?: { open: string; close: string; isOpen: boolean };
    tuesday?: { open: string; close: string; isOpen: boolean };
    wednesday?: { open: string; close: string; isOpen: boolean };
    thursday?: { open: string; close: string; isOpen: boolean };
    friday?: { open: string; close: string; isOpen: boolean };
    saturday?: { open: string; close: string; isOpen: boolean };
    sunday?: { open: string; close: string; isOpen: boolean };
  };

  // Financial settings
  @Column({ name: 'financial_settings', type: 'jsonb', nullable: true })
  financialSettings: {
    defaultPaymentTerms?: number;
    creditLimit?: number;
    taxRate?: number;
    defaultCostCenter?: string;
    budgetPeriod?: 'monthly' | 'quarterly' | 'annually';
    approvalThresholds?: {
      purchase?: number;
      expense?: number;
      transfer?: number;
    };
    bankAccounts?: Array<{
      accountName: string;
      accountNumber: string;
      bankName: string;
      branchName: string;
      isDefault: boolean;
    }>;
  };

  // Business settings
  @Column({ name: 'business_settings', type: 'jsonb', nullable: true })
  businessSettings: {
    inventoryMethod?: 'FIFO' | 'LIFO' | 'AVERAGE';
    stockValuationMethod?: 'standard' | 'average' | 'actual';
    autoReorderEnabled?: boolean;
    multiLocationEnabled?: boolean;
    barcodePrefix?: string;
    defaultWarehouse?: string;
    qualityControlEnabled?: boolean;
    lotTrackingEnabled?: boolean;
    serialTrackingEnabled?: boolean;
    expiryTrackingEnabled?: boolean;
  };

  // Integration settings
  @Column({ name: 'integration_settings', type: 'jsonb', nullable: true })
  integrationSettings: {
    erpSystem?: string;
    accountingSystem?: string;
    posSystem?: string;
    ecommerceChannels?: string[];
    paymentGateways?: string[];
    shippingProviders?: string[];
    syncEnabled?: boolean;
    apiKeys?: Record<string, string>;
  };

  // Compliance and certification
  @Column({ name: 'compliance_settings', type: 'jsonb', nullable: true })
  complianceSettings: {
    isoChartification?: string[];
    industryStandards?: string[];
    environmentalCompliance?: boolean;
    laborCompliance?: boolean;
    dataProtectionCompliance?: boolean;
    auditSchedule?: string;
    lastAuditDate?: Date;
    nextAuditDate?: Date;
  };

  // Performance metrics
  @Column({ name: 'performance_metrics', type: 'jsonb', nullable: true })
  performanceMetrics: {
    monthlyRevenue?: number;
    monthlyExpenses?: number;
    profitMargin?: number;
    inventoryTurnover?: number;
    customerSatisfaction?: number;
    employeeProductivity?: number;
    lastUpdated?: Date;
  };

  // Subscription and billing information
  @Column({ name: 'subscription_plan', length: 50, nullable: true })
  subscriptionPlan: string;

  @Column({ name: 'billing_cycle', length: 20, default: 'monthly' })
  billingCycle: 'monthly' | 'quarterly' | 'annually';

  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };

  @Column({ name: 'billing_contact', type: 'jsonb', nullable: true })
  billingContact: {
    name?: string;
    email?: string;
    phone?: string;
    position?: string;
  };

  // Metadata and customization
  @Column({ name: 'custom_fields', type: 'jsonb', nullable: true })
  customFields: Record<string, any>;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  // Logo and branding
  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string;

  @Column({ name: 'brand_colors', type: 'jsonb', nullable: true })
  brandColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };

  // Relationships
  @OneToMany(() => Department, department => department.company)
  departments: Department[];

  // Helper methods
  isSubsidiary(): boolean {
    return this.type === CompanyType.SUBSIDIARY;
  }

  isHolding(): boolean {
    return this.type === CompanyType.HOLDING || this.isHoldingCompany;
  }

  isBranch(): boolean {
    return this.type === CompanyType.BRANCH;
  }

  getIsActive(): boolean {
    return this.status === CompanyStatus.ACTIVE && this.isActive;
  }

  canTransferToCompany(targetCompany: Company): boolean {
    if (!this.allowsInterCompanyTransfers) return false;
    if (!targetCompany.allowsInterCompanyTransfers) return false;
    if (this.tenantId !== targetCompany.tenantId) return false;
    return true;
  }

  requiresTransferApproval(): boolean {
    return this.requiresApprovalForTransfers;
  }

  isConsolidationEnabled(): boolean {
    return this.consolidationEnabled;
  }

  hasSeparateBilling(): boolean {
    return this.separateBilling;
  }

  getFullName(): string {
    return this.legalName || this.name;
  }

  getDisplayName(): string {
    return this.displayName || this.name;
  }

  getBusinessHoursForDay(
    day: string,
  ): { open: string; close: string; isOpen: boolean } | null {
    return this.businessHours?.[day.toLowerCase()] || null;
  }

  isOpenOnDay(day: string): boolean {
    const hours = this.getBusinessHoursForDay(day);
    return hours?.isOpen || false;
  }

  getApprovalThreshold(type: 'purchase' | 'expense' | 'transfer'): number {
    return this.financialSettings?.approvalThresholds?.[type] || 0;
  }

  requiresApprovalForAmount(
    amount: number,
    type: 'purchase' | 'expense' | 'transfer',
  ): boolean {
    const threshold = this.getApprovalThreshold(type);
    return threshold > 0 && amount >= threshold;
  }

  addCustomField(key: string, value: any): void {
    if (!this.customFields) {
      this.customFields = {};
    }
    this.customFields[key] = value;
  }

  getCustomField(key: string, defaultValue: any = null): any {
    return this.customFields?.[key] || defaultValue;
  }

  addTag(tag: string): void {
    if (!this.tags) {
      this.tags = [];
    }
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  removeTag(tag: string): void {
    if (this.tags) {
      this.tags = this.tags.filter(t => t !== tag);
    }
  }

  calculateCompanySize(): CompanySize {
    if (!this.employeeCount) return CompanySize.MICRO;

    if (this.employeeCount < 10) return CompanySize.MICRO;
    if (this.employeeCount <= 50) return CompanySize.SMALL;
    if (this.employeeCount <= 250) return CompanySize.MEDIUM;
    return CompanySize.LARGE;
  }

  updateCompanySize(): void {
    this.companySize = this.calculateCompanySize();
  }

  isWithinEmployeeLimit(): boolean {
    if (!this.maxEmployees) return true;
    return !this.employeeCount || this.employeeCount <= this.maxEmployees;
  }

  getHierarchyPath(): string {
    return this.path || this.code;
  }

  updatePerformanceMetrics(
    metrics: Partial<Company['performanceMetrics']>,
  ): void {
    this.performanceMetrics = {
      ...this.performanceMetrics,
      ...metrics,
      lastUpdated: new Date(),
    };
  }

  isFinancialDataComplete(): boolean {
    return !!(this.taxId && this.businessLicense && this.currency);
  }

  isContactInfoComplete(): boolean {
    return !!(this.email && this.phoneNumber && this.addressLine1 && this.city);
  }

  isSetupComplete(): boolean {
    return this.isFinancialDataComplete() && this.isContactInfoComplete();
  }

  activate(): void {
    this.status = CompanyStatus.ACTIVE;
    this.isActive = true;
  }

  deactivate(): void {
    this.status = CompanyStatus.INACTIVE;
    this.isActive = false;
  }

  suspend(reason?: string): void {
    this.status = CompanyStatus.SUSPENDED;
    this.isActive = false;
    if (reason) {
      this.addCustomField('suspension_reason', reason);
      this.addCustomField('suspended_at', new Date());
    }
  }

  dissolve(reason?: string): void {
    this.status = CompanyStatus.DISSOLVED;
    this.isActive = false;
    if (reason) {
      this.addCustomField('dissolution_reason', reason);
      this.addCustomField('dissolved_at', new Date());
    }
  }

  validateBusinessHours(): boolean {
    if (!this.businessHours) return true;

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    for (const day in this.businessHours) {
      const hours = this.businessHours[day];
      if (
        hours.isOpen &&
        (!timeRegex.test(hours.open) || !timeRegex.test(hours.close))
      ) {
        return false;
      }
    }

    return true;
  }
}
