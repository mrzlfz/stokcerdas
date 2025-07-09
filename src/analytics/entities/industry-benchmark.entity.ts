import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum IndustryType {
  RETAIL_FOOD = 'retail_food',
  RETAIL_FASHION = 'retail_fashion',
  RETAIL_ELECTRONICS = 'retail_electronics',
  RETAIL_BEAUTY = 'retail_beauty',
  RETAIL_HOME = 'retail_home',
  RETAIL_AUTOMOTIVE = 'retail_automotive',
  WHOLESALE_FMCG = 'wholesale_fmcg',
  E_COMMERCE = 'e_commerce',
  MANUFACTURING = 'manufacturing',
  SERVICES = 'services',
}

export enum MetricCategory {
  FINANCIAL = 'financial',
  OPERATIONAL = 'operational',
  CUSTOMER = 'customer',
  INVENTORY = 'inventory',
  SALES = 'sales',
  MARKETING = 'marketing',
}

export enum BenchmarkSource {
  BANK_INDONESIA = 'bank_indonesia',
  BPS_STATISTICS = 'bps_statistics',
  KADIN_INDONESIA = 'kadin_indonesia',
  INDUSTRY_ASSOCIATION = 'industry_association',
  MARKET_RESEARCH = 'market_research',
  PEER_NETWORK = 'peer_network',
  THIRD_PARTY_DATA = 'third_party_data',
  INTERNAL_ANALYSIS = 'internal_analysis',
}

export enum DataQuality {
  VERIFIED = 'verified',
  PRELIMINARY = 'preliminary',
  ESTIMATED = 'estimated',
  DERIVED = 'derived',
}

export enum RegionScope {
  NATIONAL = 'national',
  JAKARTA = 'jakarta',
  JAVA = 'java',
  SUMATRA = 'sumatra',
  KALIMANTAN = 'kalimantan',
  SULAWESI = 'sulawesi',
  EASTERN_INDONESIA = 'eastern_indonesia',
  URBAN = 'urban',
  RURAL = 'rural',
}

@Entity('industry_benchmarks')
@Index(['industry', 'metricName', 'region', 'reportingPeriod'], {
  unique: false,
})
@Index(['source', 'dataQuality', 'isActive'])
@Index(['reportingPeriod', 'createdAt'])
export class IndustryBenchmark {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: IndustryType,
    comment: 'Industry classification for the benchmark',
  })
  @Index()
  industry: IndustryType;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'Specific metric being benchmarked',
  })
  @Index()
  metricName: string;

  @Column({
    type: 'enum',
    enum: MetricCategory,
    comment: 'Category of the metric',
  })
  metricCategory: MetricCategory;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'Detailed description of the metric',
  })
  metricDescription: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    comment: 'Main benchmark value',
  })
  value: number;

  @Column({
    type: 'varchar',
    length: 50,
    comment: 'Unit of measurement (percentage, currency, ratio, etc.)',
  })
  unit: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    comment: '25th percentile value',
  })
  percentile25: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    comment: '50th percentile (median) value',
  })
  percentile50: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    comment: '75th percentile value',
  })
  percentile75: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    comment: '90th percentile value',
  })
  percentile90: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
    comment: '95th percentile value',
  })
  percentile95: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
    comment: 'Standard deviation of the metric',
  })
  standardDeviation: number;

  @Column({
    type: 'integer',
    comment: 'Number of companies/data points in the sample',
  })
  sampleSize: number;

  @Column({
    type: 'enum',
    enum: BenchmarkSource,
    comment: 'Source of the benchmark data',
  })
  @Index()
  source: BenchmarkSource;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Specific source reference or URL',
  })
  sourceReference: string;

  @Column({
    type: 'enum',
    enum: DataQuality,
    comment: 'Quality and reliability of the data',
  })
  @Index()
  dataQuality: DataQuality;

  @Column({
    type: 'enum',
    enum: RegionScope,
    comment: 'Geographic scope of the benchmark',
  })
  @Index()
  region: RegionScope;

  @Column({
    type: 'varchar',
    length: 50,
    comment: 'Reporting period (Q1-2025, 2024, etc.)',
  })
  @Index()
  reportingPeriod: string;

  @Column({
    type: 'date',
    comment: 'Start date of the data collection period',
  })
  periodStartDate: Date;

  @Column({
    type: 'date',
    comment: 'End date of the data collection period',
  })
  periodEndDate: Date;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Subcategory or product segment',
  })
  subcategory: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'Company size classification (small, medium, large)',
  })
  companySize: string;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Additional contextual information',
  })
  context: {
    economicConditions?: string;
    marketTrends?: string[];
    regulatoryChanges?: string[];
    methodology?: string;
    limitations?: string[];
    notes?: string;
  };

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Statistical confidence and reliability metrics',
  })
  confidenceMetrics: {
    confidenceLevel: number; // 0-100
    marginOfError: number;
    reliabilityScore: number; // 0-100
    dataCompletenessScore: number; // 0-100
    outlierAdjustment: boolean;
    weightingMethod?: string;
  };

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Trend analysis and historical comparison',
  })
  trendAnalysis: {
    yearOverYearChange: number;
    quarterOverQuarterChange: number;
    trendDirection: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    cyclicalPattern: string;
    seasonalityFactor: number;
    growthRate: number;
  };

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Peer comparison and competitive context',
  })
  peerContext: {
    topPerformerValue: number;
    industryLeaderValue: number;
    competitivePosition: string;
    marketShareImpact: number;
    differentiationFactors: string[];
  };

  @Column({
    type: 'boolean',
    default: true,
    comment: 'Whether this benchmark is currently active',
  })
  @Index()
  isActive: boolean;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Whether this benchmark is validated by experts',
  })
  isValidated: boolean;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Whether this benchmark is marked as outlier',
  })
  isOutlier: boolean;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 1.0,
    comment: 'Priority weight for this benchmark (0.1-5.0)',
  })
  priorityWeight: number;

  @Column({
    type: 'date',
    nullable: true,
    comment: 'Date when this benchmark expires or needs refresh',
  })
  expiryDate: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'Last time this benchmark was refreshed from source',
  })
  lastRefreshed: Date;

  @Column({
    type: 'integer',
    default: 0,
    comment: 'Number of times this benchmark has been accessed',
  })
  accessCount: number;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Usage analytics and performance tracking',
  })
  usageAnalytics: {
    averageAccuracy: number; // 0-100
    userFeedbackScore: number; // 0-100
    businessImpactScore: number; // 0-100
    lastUsedAt: string;
    popularityScore: number; // 0-100
  };

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Timestamp when the benchmark was created',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    comment: 'Timestamp when the benchmark was last updated',
  })
  updatedAt: Date;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'User or system that created this benchmark',
  })
  createdBy: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'User or system that last updated this benchmark',
  })
  updatedBy: string;
}
