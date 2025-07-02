import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuditableEntity } from '../../common/entities/auditable.entity';
import { Company } from './company.entity';
import { User } from '../../users/entities/user.entity';

export enum ReportType {
  FINANCIAL_STATEMENT = 'financial_statement',
  PROFIT_LOSS = 'profit_loss',
  BALANCE_SHEET = 'balance_sheet',
  CASH_FLOW = 'cash_flow',
  INVENTORY_SUMMARY = 'inventory_summary',
  SALES_SUMMARY = 'sales_summary',
  PURCHASE_SUMMARY = 'purchase_summary',
  INTER_COMPANY_TRANSACTIONS = 'inter_company_transactions',
  PERFORMANCE_METRICS = 'performance_metrics',
  COMPLIANCE_REPORT = 'compliance_report',
  TAX_REPORT = 'tax_report',
  OPERATIONAL_REPORT = 'operational_report',
  STRATEGIC_REPORT = 'strategic_report',
  CUSTOM = 'custom',
}

export enum ReportStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUALLY = 'semi_annually',
  ANNUALLY = 'annually',
  CUSTOM_RANGE = 'custom_range',
}

export enum ConsolidationMethod {
  FULL = 'full',                    // 100% consolidation
  PROPORTIONAL = 'proportional',    // Based on ownership percentage
  EQUITY = 'equity',                // Equity method
  COST = 'cost',                    // Cost method
  ELIMINATION = 'elimination',      // With inter-company eliminations
}

export enum DataAggregation {
  SUM = 'sum',
  AVERAGE = 'average',
  WEIGHTED_AVERAGE = 'weighted_average',
  MINIMUM = 'minimum',
  MAXIMUM = 'maximum',
  COUNT = 'count',
  MEDIAN = 'median',
  FIRST = 'first',
  LAST = 'last',
}

@Entity('consolidated_reports')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'reportNumber'])
@Index(['tenantId', 'reportType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'parentCompanyId'])
@Index(['tenantId', 'reportPeriod'])
@Index(['tenantId', 'periodStart', 'periodEnd'])
@Index(['status', 'generatedDate'])
export class ConsolidatedReport extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  // Report identification
  @Column({ name: 'report_number', length: 50, unique: true })
  reportNumber: string;

  @Column({ name: 'report_name', length: 200 })
  reportName: string;

  @Column({ name: 'report_title', length: 300, nullable: true })
  reportTitle: string;

  @Column({
    name: 'report_type',
    type: 'enum',
    enum: ReportType,
  })
  reportType: ReportType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.DRAFT,
  })
  status: ReportStatus;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  // Parent company and scope
  @Column({ name: 'parent_company_id', type: 'uuid' })
  parentCompanyId: string;

  @ManyToOne(() => Company, { eager: true })
  @JoinColumn({ name: 'parent_company_id' })
  parentCompany: Company;

  @Column({ name: 'included_companies', type: 'simple-array' })
  includedCompanies: string[]; // Array of company IDs

  @Column({ name: 'excluded_companies', type: 'simple-array', nullable: true })
  excludedCompanies: string[]; // Array of company IDs to exclude

  @Column({ name: 'company_filter_criteria', type: 'jsonb', nullable: true })
  companyFilterCriteria: {
    companyTypes?: string[];
    businessTypes?: string[];
    statuses?: string[];
    minimumOwnership?: number;
    regions?: string[];
    customCriteria?: Record<string, any>;
  };

  // Consolidation settings
  @Column({
    name: 'consolidation_method',
    type: 'enum',
    enum: ConsolidationMethod,
    default: ConsolidationMethod.FULL,
  })
  consolidationMethod: ConsolidationMethod;

  @Column({ name: 'eliminate_inter_company', type: 'boolean', default: true })
  eliminateInterCompany: boolean;

  @Column({ name: 'apply_ownership_percentage', type: 'boolean', default: false })
  applyOwnershipPercentage: boolean;

  @Column({ name: 'currency_conversion', type: 'boolean', default: true })
  currencyConversion: boolean;

  @Column({ name: 'base_currency', length: 3, default: 'IDR' })
  baseCurrency: string;

  @Column({ name: 'exchange_rate_date', type: 'date', nullable: true })
  exchangeRateDate: Date;

  // Reporting period
  @Column({
    name: 'report_period',
    type: 'enum',
    enum: ReportPeriod,
    default: ReportPeriod.MONTHLY,
  })
  reportPeriod: ReportPeriod;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: Date;

  @Column({ name: 'fiscal_year', type: 'integer', nullable: true })
  fiscalYear: number;

  @Column({ name: 'fiscal_quarter', type: 'integer', nullable: true })
  fiscalQuarter: number; // 1, 2, 3, 4

  @Column({ name: 'fiscal_month', type: 'integer', nullable: true })
  fiscalMonth: number; // 1-12

  @Column({ name: 'comparison_period_start', type: 'date', nullable: true })
  comparisonPeriodStart: Date;

  @Column({ name: 'comparison_period_end', type: 'date', nullable: true })
  comparisonPeriodEnd: Date;

  // Report generation
  @Column({ name: 'generated_date', type: 'timestamp', nullable: true })
  generatedDate: Date;

  @Column({ name: 'generated_by_id', type: 'uuid', nullable: true })
  generatedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'generated_by_id' })
  generatedBy: User;

  @Column({ name: 'generation_time_seconds', type: 'integer', nullable: true })
  generationTimeSeconds: number;

  @Column({ name: 'data_source_count', type: 'integer', nullable: true })
  dataSourceCount: number;

  @Column({ name: 'total_records_processed', type: 'integer', nullable: true })
  totalRecordsProcessed: number;

  // Report data and structure
  @Column({ name: 'report_structure', type: 'jsonb', nullable: true })
  reportStructure: {
    sections?: Array<{
      id: string;
      name: string;
      order: number;
      type: 'table' | 'chart' | 'text' | 'summary' | 'details';
      configuration: Record<string, any>;
    }>;
    columns?: Array<{
      id: string;
      name: string;
      dataType: 'number' | 'text' | 'date' | 'currency' | 'percentage';
      aggregation?: DataAggregation;
      format?: string;
      visible?: boolean;
    }>;
    filters?: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
    sorting?: Array<{
      field: string;
      direction: 'asc' | 'desc';
    }>;
  };

  @Column({ name: 'report_data', type: 'jsonb', nullable: true })
  reportData: {
    summary?: Record<string, any>;
    details?: Array<Record<string, any>>;
    charts?: Array<{
      type: string;
      title: string;
      data: Record<string, any>;
    }>;
    metadata?: Record<string, any>;
    footnotes?: string[];
    calculations?: Record<string, any>;
  };

  @Column({ name: 'consolidation_adjustments', type: 'jsonb', nullable: true })
  consolidationAdjustments: Array<{
    id: string;
    type: 'elimination' | 'reclassification' | 'currency' | 'ownership' | 'other';
    description: string;
    fromCompanyId?: string;
    toCompanyId?: string;
    account?: string;
    amount: number;
    currency?: string;
    reason: string;
    automaticAdjustment: boolean;
  }>;

  // Calculations and formulas
  @Column({ name: 'calculation_formulas', type: 'jsonb', nullable: true })
  calculationFormulas: Record<string, {
    formula: string;
    description: string;
    dependencies: string[];
    resultType: 'number' | 'percentage' | 'currency' | 'text';
  }>;

  @Column({ name: 'derived_metrics', type: 'jsonb', nullable: true })
  derivedMetrics: Record<string, {
    value: number;
    unit: string;
    calculation: string;
    benchmark?: number;
    variance?: number;
    variancePercentage?: number;
  }>;

  // Performance benchmarks
  @Column({ name: 'benchmarks', type: 'jsonb', nullable: true })
  benchmarks: {
    industryAverages?: Record<string, number>;
    previousPeriod?: Record<string, number>;
    budget?: Record<string, number>;
    targets?: Record<string, number>;
    competitorData?: Record<string, number>;
  };

  // Quality and validation
  @Column({ name: 'data_quality_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  dataQualityScore: number; // 0-100

  @Column({ name: 'validation_rules', type: 'jsonb', nullable: true })
  validationRules: Array<{
    id: string;
    name: string;
    rule: string;
    severity: 'error' | 'warning' | 'info';
    passed: boolean;
    message?: string;
  }>;

  @Column({ name: 'validation_errors', type: 'jsonb', nullable: true })
  validationErrors: Array<{
    type: string;
    field: string;
    value: any;
    message: string;
    severity: 'critical' | 'major' | 'minor';
  }>;

  @Column({ name: 'data_completeness', type: 'decimal', precision: 5, scale: 2, nullable: true })
  dataCompleteness: number; // Percentage of complete data

  // Approval and authorization
  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval: boolean;

  @Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
  approvedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({ name: 'approved_date', type: 'timestamp', nullable: true })
  approvedDate: Date;

  @Column({ name: 'approval_notes', type: 'text', nullable: true })
  approvalNotes: string;

  // Distribution and sharing
  @Column({ name: 'is_confidential', type: 'boolean', default: false })
  isConfidential: boolean;

  @Column({ name: 'access_level', type: 'varchar', length: 50, default: 'internal' })
  accessLevel: 'public' | 'internal' | 'confidential' | 'restricted';

  @Column({ name: 'authorized_viewers', type: 'simple-array', nullable: true })
  authorizedViewers: string[]; // User IDs

  @Column({ name: 'distribution_list', type: 'simple-array', nullable: true })
  distributionList: string[]; // Email addresses

  @Column({ name: 'published_date', type: 'timestamp', nullable: true })
  publishedDate: Date;

  @Column({ name: 'published_by_id', type: 'uuid', nullable: true })
  publishedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by_id' })
  publishedBy: User;

  // File storage
  @Column({ name: 'report_file_url', type: 'text', nullable: true })
  reportFileUrl: string;

  @Column({ name: 'report_file_format', length: 10, nullable: true })
  reportFileFormat: 'pdf' | 'excel' | 'csv' | 'json' | 'xml';

  @Column({ name: 'report_file_size', type: 'integer', nullable: true })
  reportFileSize: number; // bytes

  @Column({ name: 'alternative_formats', type: 'jsonb', nullable: true })
  alternativeFormats: Array<{
    format: string;
    url: string;
    size: number;
    generatedDate: Date;
  }>;

  // Scheduling and automation
  @Column({ name: 'is_automated', type: 'boolean', default: false })
  isAutomated: boolean;

  @Column({ name: 'schedule_cron', length: 100, nullable: true })
  scheduleCron: string;

  @Column({ name: 'next_generation_date', type: 'timestamp', nullable: true })
  nextGenerationDate: Date;

  @Column({ name: 'auto_distribute', type: 'boolean', default: false })
  autoDistribute: boolean;

  @Column({ name: 'generation_count', type: 'integer', default: 1 })
  generationCount: number;

  @Column({ name: 'last_auto_generated', type: 'timestamp', nullable: true })
  lastAutoGenerated: Date;

  // Custom fields and metadata
  @Column({ name: 'custom_fields', type: 'jsonb', nullable: true })
  customFields: Record<string, any>;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  // Template and configuration
  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string;

  @Column({ name: 'is_template', type: 'boolean', default: false })
  isTemplate: boolean;

  @Column({ name: 'template_name', length: 200, nullable: true })
  templateName: string;

  @Column({ name: 'configuration', type: 'jsonb', nullable: true })
  configuration: Record<string, any>;

  // Helper methods
  isCompleted(): boolean {
    return this.status === ReportStatus.COMPLETED;
  }

  isPublished(): boolean {
    return this.status === ReportStatus.PUBLISHED;
  }

  canBeModified(): boolean {
    return [ReportStatus.DRAFT, ReportStatus.FAILED].includes(this.status);
  }

  canBeGenerated(): boolean {
    return [ReportStatus.DRAFT, ReportStatus.FAILED].includes(this.status);
  }

  canBeApproved(): boolean {
    return this.status === ReportStatus.COMPLETED && this.requiresApproval && !this.approvedDate;
  }

  canBePublished(): boolean {
    if (this.requiresApproval) {
      return this.status === ReportStatus.APPROVED;
    }
    return this.status === ReportStatus.COMPLETED;
  }

  isExpired(): boolean {
    // Reports are considered expired after 1 year for regulatory compliance
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return this.generatedDate && this.generatedDate < oneYearAgo;
  }

  getCurrentPeriodLabel(): string {
    const start = this.periodStart.toLocaleDateString('id-ID');
    const end = this.periodEnd.toLocaleDateString('id-ID');
    
    switch (this.reportPeriod) {
      case ReportPeriod.DAILY:
        return start;
      case ReportPeriod.MONTHLY:
        return `${this.periodStart.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
      case ReportPeriod.QUARTERLY:
        return `Q${this.fiscalQuarter} ${this.fiscalYear}`;
      case ReportPeriod.ANNUALLY:
        return `${this.fiscalYear}`;
      default:
        return `${start} - ${end}`;
    }
  }

  calculateDataCompleteness(): number {
    if (!this.reportData || !this.reportData.details) return 0;
    
    const details = this.reportData.details;
    if (details.length === 0) return 0;
    
    const totalFields = Object.keys(details[0] || {}).length;
    let completeFields = 0;
    
    details.forEach(record => {
      Object.values(record).forEach(value => {
        if (value !== null && value !== undefined && value !== '') {
          completeFields++;
        }
      });
    });
    
    return Math.round((completeFields / (details.length * totalFields)) * 100);
  }

  updateDataCompleteness(): void {
    this.dataCompleteness = this.calculateDataCompleteness();
  }

  addIncludedCompany(companyId: string): void {
    if (!this.includedCompanies.includes(companyId)) {
      this.includedCompanies.push(companyId);
    }
  }

  removeIncludedCompany(companyId: string): void {
    this.includedCompanies = this.includedCompanies.filter(id => id !== companyId);
  }

  addExcludedCompany(companyId: string): void {
    if (!this.excludedCompanies) {
      this.excludedCompanies = [];
    }
    if (!this.excludedCompanies.includes(companyId)) {
      this.excludedCompanies.push(companyId);
    }
    this.removeIncludedCompany(companyId);
  }

  removeExcludedCompany(companyId: string): void {
    if (this.excludedCompanies) {
      this.excludedCompanies = this.excludedCompanies.filter(id => id !== companyId);
    }
  }

  addConsolidationAdjustment(adjustment: ConsolidatedReport['consolidationAdjustments'][0]): void {
    if (!this.consolidationAdjustments) {
      this.consolidationAdjustments = [];
    }
    this.consolidationAdjustments.push(adjustment);
  }

  removeConsolidationAdjustment(adjustmentId: string): void {
    if (this.consolidationAdjustments) {
      this.consolidationAdjustments = this.consolidationAdjustments.filter(adj => adj.id !== adjustmentId);
    }
  }

  addValidationError(error: ConsolidatedReport['validationErrors'][0]): void {
    if (!this.validationErrors) {
      this.validationErrors = [];
    }
    this.validationErrors.push(error);
  }

  clearValidationErrors(): void {
    this.validationErrors = [];
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

  calculateGenerationTime(): void {
    if (this.createdAt && this.generatedDate) {
      const diffMs = this.generatedDate.getTime() - this.createdAt.getTime();
      this.generationTimeSeconds = Math.floor(diffMs / 1000);
    }
  }

  // Status transition methods
  startGeneration(): void {
    this.status = ReportStatus.GENERATING;
    this.addCustomField('generation_started_at', new Date());
  }

  completeGeneration(generatedBy: string): void {
    this.status = ReportStatus.COMPLETED;
    this.generatedDate = new Date();
    this.generatedById = generatedBy;
    this.generationCount += 1;
    this.calculateGenerationTime();
    this.updateDataCompleteness();
  }

  failGeneration(error: string): void {
    this.status = ReportStatus.FAILED;
    this.addCustomField('generation_failed_at', new Date());
    this.addCustomField('generation_error', error);
  }

  approve(approvedBy: string, notes?: string): void {
    if (this.canBeApproved()) {
      this.status = ReportStatus.APPROVED;
      this.approvedById = approvedBy;
      this.approvedDate = new Date();
      if (notes) {
        this.approvalNotes = notes;
      }
    }
  }

  publish(publishedBy: string): void {
    if (this.canBePublished()) {
      this.status = ReportStatus.PUBLISHED;
      this.publishedById = publishedBy;
      this.publishedDate = new Date();
    }
  }

  archive(): void {
    this.status = ReportStatus.ARCHIVED;
    this.addCustomField('archived_at', new Date());
  }

  scheduleNextGeneration(): void {
    if (this.isAutomated && this.scheduleCron) {
      // Calculate next generation date based on cron expression
      // This would typically use a cron parser library
      const now = new Date();
      
      switch (this.reportPeriod) {
        case ReportPeriod.DAILY:
          this.nextGenerationDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case ReportPeriod.WEEKLY:
          this.nextGenerationDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case ReportPeriod.MONTHLY:
          this.nextGenerationDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case ReportPeriod.QUARTERLY:
          this.nextGenerationDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
          break;
        case ReportPeriod.ANNUALLY:
          this.nextGenerationDate = new Date(now.getFullYear() + 1, 0, 1);
          break;
      }
    }
  }

  validateReportData(): boolean {
    if (!this.includedCompanies || this.includedCompanies.length === 0) return false;
    if (!this.periodStart || !this.periodEnd) return false;
    if (this.periodStart >= this.periodEnd) return false;
    
    return true;
  }

  getReportTypeDisplayName(): string {
    const typeMap = {
      [ReportType.FINANCIAL_STATEMENT]: 'Laporan Keuangan',
      [ReportType.PROFIT_LOSS]: 'Laporan Laba Rugi',
      [ReportType.BALANCE_SHEET]: 'Neraca',
      [ReportType.CASH_FLOW]: 'Laporan Arus Kas',
      [ReportType.INVENTORY_SUMMARY]: 'Ringkasan Inventori',
      [ReportType.SALES_SUMMARY]: 'Ringkasan Penjualan',
      [ReportType.PURCHASE_SUMMARY]: 'Ringkasan Pembelian',
      [ReportType.INTER_COMPANY_TRANSACTIONS]: 'Transaksi Antar Perusahaan',
      [ReportType.PERFORMANCE_METRICS]: 'Metrik Kinerja',
      [ReportType.COMPLIANCE_REPORT]: 'Laporan Kepatuhan',
      [ReportType.TAX_REPORT]: 'Laporan Pajak',
      [ReportType.OPERATIONAL_REPORT]: 'Laporan Operasional',
      [ReportType.STRATEGIC_REPORT]: 'Laporan Strategis',
      [ReportType.CUSTOM]: 'Laporan Khusus',
    };
    return typeMap[this.reportType] || this.reportType;
  }
}