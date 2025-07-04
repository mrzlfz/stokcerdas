import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum TrustServiceCriteria {
  SECURITY = 'security',
  AVAILABILITY = 'availability',
  PROCESSING_INTEGRITY = 'processing_integrity',
  CONFIDENTIALITY = 'confidentiality',
  PRIVACY = 'privacy',
}

export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
}

export enum ControlFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
}

export enum ControlStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  UNDER_REVIEW = 'under_review',
  REMEDIATION_REQUIRED = 'remediation_required',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('soc2_controls')
@Index(['tenantId', 'isDeleted'])
@Index(['controlId'])
@Index(['criteria', 'status'])
export class SOC2Control extends BaseEntity {
  @Column({ type: 'varchar', length: 20, unique: true })
  controlId: string; // e.g., CC1.1, CC2.1, A1.1

  @Column({ type: 'varchar', length: 255 })
  controlName: string;

  @Column({ type: 'text' })
  controlDescription: string;

  @Column({
    type: 'enum',
    enum: TrustServiceCriteria,
  })
  criteria: TrustServiceCriteria;

  @Column({
    type: 'enum',
    enum: ControlType,
  })
  controlType: ControlType;

  @Column({
    type: 'enum',
    enum: ControlFrequency,
  })
  frequency: ControlFrequency;

  @Column({
    type: 'enum',
    enum: ControlStatus,
    default: ControlStatus.ACTIVE,
  })
  status: ControlStatus;

  @Column({
    type: 'enum',
    enum: RiskLevel,
  })
  riskLevel: RiskLevel;

  @Column({ type: 'text' })
  controlObjective: string;

  @Column({ type: 'text' })
  controlActivity: string;

  @Column({ type: 'jsonb', nullable: true })
  implementationGuidance?: {
    procedures: string[];
    responsibilities: string[];
    documentation: string[];
    evidenceRequirements: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  automationDetails?: {
    isAutomated: boolean;
    systemComponent?: string;
    monitoringMethod?: string;
    alertingConfiguration?: any;
  };

  @Column({ type: 'varchar', length: 255 })
  controlOwner: string; // Department/Role responsible

  @Column({ type: 'varchar', length: 255, nullable: true })
  controlOwnerBackup?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastTestDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextTestDate?: Date;

  @Column({ type: 'text', nullable: true })
  testResults?: string;

  @Column({ type: 'jsonb', nullable: true })
  exceptions?: {
    id: string;
    description: string;
    severity: RiskLevel;
    identifiedDate: Date;
    targetRemediationDate: Date;
    status: 'open' | 'in_progress' | 'closed';
    remediationPlan?: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  relatedControls?: {
    dependencies: string[]; // Control IDs that this control depends on
    supports: string[]; // Control IDs that this control supports
  };

  @Column({ type: 'text', nullable: true })
  additionalNotes?: string;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @OneToMany(() => SOC2ControlEvidence, evidence => evidence.control)
  evidence: SOC2ControlEvidence[];

  @OneToMany(() => SOC2ControlTest, test => test.control)
  tests: SOC2ControlTest[];

  // Helper methods
  get isOverdue(): boolean {
    if (!this.nextTestDate) return false;
    return new Date() > this.nextTestDate;
  }

  get daysSinceLastTest(): number {
    if (!this.lastTestDate) return -1;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.lastTestDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get hasActiveExceptions(): boolean {
    return (
      this.exceptions?.some(
        ex => ex.status === 'open' || ex.status === 'in_progress',
      ) || false
    );
  }

  get riskScore(): number {
    let score = 0;

    // Base risk level score
    switch (this.riskLevel) {
      case RiskLevel.CRITICAL:
        score += 40;
        break;
      case RiskLevel.HIGH:
        score += 30;
        break;
      case RiskLevel.MEDIUM:
        score += 20;
        break;
      case RiskLevel.LOW:
        score += 10;
        break;
    }

    // Add points for overdue testing
    if (this.isOverdue) score += 20;

    // Add points for active exceptions
    if (this.hasActiveExceptions) {
      const criticalExceptions =
        this.exceptions?.filter(
          ex => ex.severity === RiskLevel.CRITICAL && ex.status !== 'closed',
        ).length || 0;
      score += criticalExceptions * 15;
    }

    // Add points for days since last test
    const daysSince = this.daysSinceLastTest;
    if (daysSince > 90) score += 10;
    if (daysSince > 180) score += 15;

    return Math.min(score, 100); // Cap at 100
  }
}

@Entity('soc2_control_evidence')
@Index(['tenantId', 'controlId'])
export class SOC2ControlEvidence extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  controlId: string;

  @Column({ type: 'varchar', length: 255 })
  evidenceType: string; // Screenshot, Log Export, Policy Document, etc.

  @Column({ type: 'varchar', length: 255 })
  evidenceName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string; // S3 path or local file path

  @Column({ type: 'varchar', length: 50 })
  fileHash: string; // SHA-256 hash for integrity

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'timestamp' })
  collectionDate: Date;

  @Column({ type: 'varchar', length: 255 })
  collectedBy: string; // User ID or system

  @Column({ type: 'timestamp' })
  periodStart: Date; // Evidence covers this period

  @Column({ type: 'timestamp' })
  periodEnd: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    automaticCollection: boolean;
    retentionPeriod: number; // days
    tags: string[];
    relatedAuditItems?: string[];
    confidentialityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  };

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  control: SOC2Control;
}

@Entity('soc2_control_tests')
@Index(['tenantId', 'controlId', 'testDate'])
export class SOC2ControlTest extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  controlId: string;

  @Column({ type: 'varchar', length: 255 })
  testName: string;

  @Column({ type: 'text' })
  testDescription: string;

  @Column({ type: 'varchar', length: 50 })
  testMethod: string; // Inquiry, Observation, Inspection, Re-performance

  @Column({ type: 'timestamp' })
  testDate: Date;

  @Column({ type: 'varchar', length: 255 })
  tester: string; // User ID who performed test

  @Column({ type: 'varchar', length: 50 })
  testResult: string; // Passed, Failed, Not Applicable, Exception

  @Column({ type: 'text', nullable: true })
  testProcedure?: string;

  @Column({ type: 'text', nullable: true })
  findings?: string;

  @Column({ type: 'jsonb', nullable: true })
  sampleDetails?: {
    populationSize: number;
    sampleSize: number;
    selectionMethod: string;
    sampleItems: any[];
  };

  @Column({ type: 'jsonb', nullable: true })
  deficiencies?: {
    id: string;
    severity: RiskLevel;
    description: string;
    rootCause?: string;
    managementResponse?: string;
    correctiveAction?: string;
    targetDate?: Date;
  }[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  workpaperReference?: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewer?: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewDate?: Date;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  control: SOC2Control;

  // Helper methods
  get passed(): boolean {
    return this.testResult.toLowerCase() === 'passed';
  }

  get hasDeficiencies(): boolean {
    return this.deficiencies && this.deficiencies.length > 0;
  }

  get criticalDeficiencies(): any[] {
    return (
      this.deficiencies?.filter(d => d.severity === RiskLevel.CRITICAL) || []
    );
  }
}
