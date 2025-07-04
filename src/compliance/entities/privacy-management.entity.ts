import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsDate,
  IsNumber,
} from 'class-validator';

// Base auditable entity with tenant isolation
export abstract class PrivacyAuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  tenantId: string;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deletedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  deletedBy: string;
}

// UU PDP Legal Basis for Data Processing
export enum LegalBasisUUPDP {
  CONSENT = 'consent', // Persetujuan dari subjek data
  CONTRACT = 'contract', // Pelaksanaan kontrak
  LEGAL_OBLIGATION = 'legal_obligation', // Kewajiban hukum
  VITAL_INTEREST = 'vital_interest', // Kepentingan vital
  PUBLIC_TASK = 'public_task', // Tugas publik
  LEGITIMATE_INTEREST = 'legitimate_interest', // Kepentingan sah
}

// Data Categories under UU PDP
export enum PersonalDataCategory {
  GENERAL = 'general', // Data pribadi umum
  SPECIFIC = 'specific', // Data pribadi spesifik (sensitif)
  BIOMETRIC = 'biometric', // Data biometrik
  HEALTH = 'health', // Data kesehatan
  FINANCIAL = 'financial', // Data keuangan
  LOCATION = 'location', // Data lokasi
  BEHAVIORAL = 'behavioral', // Data perilaku
}

// Processing Purposes
export enum ProcessingPurpose {
  USER_ACCOUNT = 'user_account', // Pengelolaan akun pengguna
  INVENTORY_MANAGEMENT = 'inventory_management', // Manajemen inventori
  ORDER_PROCESSING = 'order_processing', // Pemrosesan pesanan
  CUSTOMER_SERVICE = 'customer_service', // Layanan pelanggan
  ANALYTICS = 'analytics', // Analisis bisnis
  MARKETING = 'marketing', // Pemasaran
  LEGAL_COMPLIANCE = 'legal_compliance', // Kepatuhan hukum
  SECURITY = 'security', // Keamanan sistem
}

// Consent Status
export enum ConsentStatus {
  GIVEN = 'given', // Diberikan
  WITHDRAWN = 'withdrawn', // Ditarik
  EXPIRED = 'expired', // Kedaluwarsa
  PENDING = 'pending', // Menunggu
  REFUSED = 'refused', // Ditolak
}

// Data Subject Rights under UU PDP
export enum DataSubjectRight {
  ACCESS = 'access', // Hak akses
  RECTIFICATION = 'rectification', // Hak pembetulan
  ERASURE = 'erasure', // Hak penghapusan
  RESTRICT_PROCESSING = 'restrict_processing', // Hak pembatasan pemrosesan
  DATA_PORTABILITY = 'data_portability', // Hak portabilitas data
  OBJECT = 'object', // Hak menolak
  WITHDRAW_CONSENT = 'withdraw_consent', // Hak menarik persetujuan
}

// Request Status
export enum RequestStatus {
  PENDING = 'pending', // Menunggu
  IN_PROGRESS = 'in_progress', // Sedang diproses
  COMPLETED = 'completed', // Selesai
  REJECTED = 'rejected', // Ditolak
  PARTIALLY_COMPLETED = 'partially_completed', // Sebagian selesai
  OVERDUE = 'overdue', // Terlambat
}

/**
 * Data Classification - Klasifikasi data sesuai UU PDP
 */
@Entity('privacy_data_classification')
@Index(['tenantId', 'isDeleted'])
export class DataClassification extends PrivacyAuditableEntity {
  @Column({ type: 'varchar', length: 100, nullable: false })
  dataType: string; // Jenis data (email, phone, address, etc.)

  @Column({ type: 'varchar', length: 100, nullable: false })
  entityName: string; // Nama entity (users, customers, etc.)

  @Column({ type: 'varchar', length: 100, nullable: false })
  fieldName: string; // Nama field

  @Column({
    type: 'enum',
    enum: PersonalDataCategory,
    nullable: false,
  })
  category: PersonalDataCategory;

  @Column({
    type: 'enum',
    enum: LegalBasisUUPDP,
    nullable: false,
  })
  legalBasis: LegalBasisUUPDP;

  @Column({
    type: 'enum',
    enum: ProcessingPurpose,
    array: true,
    nullable: false,
  })
  processingPurposes: ProcessingPurpose[];

  @Column({ type: 'boolean', default: false })
  requiresConsent: boolean;

  @Column({ type: 'int', nullable: false })
  retentionDays: number; // Periode retensi dalam hari

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  processingDetails: {
    automated: boolean;
    profiling: boolean;
    crossBorderTransfer: boolean;
    thirdPartySharing: boolean;
    encryptionRequired: boolean;
    anonymizationPossible: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  riskAssessment: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    impactAssessment: string;
    mitigationMeasures: string[];
    lastAssessmentDate: Date;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}

/**
 * Consent Management - Manajemen persetujuan sesuai UU PDP
 */
@Entity('privacy_consent')
@Index(['tenantId', 'userId', 'isDeleted'])
@Index(['tenantId', 'status', 'expiryDate'])
export class PrivacyConsent extends PrivacyAuditableEntity {
  @Column({ type: 'uuid', nullable: false })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: ProcessingPurpose,
    nullable: false,
  })
  purpose: ProcessingPurpose;

  @Column({
    type: 'enum',
    enum: ConsentStatus,
    default: ConsentStatus.PENDING,
    nullable: false,
  })
  status: ConsentStatus;

  @Column({ type: 'varchar', length: 1000, nullable: false })
  consentText: string; // Teks persetujuan dalam Bahasa Indonesia

  @Column({ type: 'varchar', length: 1000, nullable: true })
  consentTextEn: string; // Teks persetujuan dalam Bahasa Inggris

  @Column({ type: 'timestamp with time zone', nullable: true })
  givenAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  withdrawnAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expiryDate: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  version: string; // Versi persetujuan

  @Column({ type: 'inet', nullable: true })
  ipAddress: string; // IP address saat memberikan persetujuan

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string; // User agent saat memberikan persetujuan

  @Column({ type: 'varchar', length: 500, nullable: true })
  withdrawalReason: string; // Alasan penarikan persetujuan

  @Column({ type: 'jsonb', nullable: true })
  consentDetails: {
    granularConsents: {
      purpose: ProcessingPurpose;
      consented: boolean;
      timestamp: Date;
    }[];
    consentMethod: 'explicit' | 'implicit' | 'opt_in' | 'pre_checked';
    evidenceType: 'digital_signature' | 'checkbox' | 'voice' | 'written';
    renewalRequired: boolean;
    childConsent: boolean;
    parentalConsent?: {
      parentName: string;
      parentEmail: string;
      verificationMethod: string;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: {
    action: 'given' | 'modified' | 'withdrawn' | 'expired' | 'renewed';
    timestamp: Date;
    userId: string;
    ipAddress: string;
    userAgent: string;
    details: any;
  }[];

  @Column({ type: 'boolean', default: false })
  isMinor: boolean; // Apakah subjek data di bawah umur

  @Column({ type: 'varchar', length: 255, nullable: true })
  legalGuardian: string; // Wali hukum untuk anak di bawah umur
}

/**
 * Data Retention Policy - Kebijakan retensi data sesuai UU PDP
 */
@Entity('privacy_data_retention_policy')
@Index(['tenantId', 'isActive', 'isDeleted'])
export class DataRetentionPolicy extends PrivacyAuditableEntity {
  @Column({ type: 'varchar', length: 255, nullable: false })
  policyName: string;

  @Column({ type: 'text', nullable: false })
  description: string;

  @Column({
    type: 'enum',
    enum: PersonalDataCategory,
    nullable: false,
  })
  dataCategory: PersonalDataCategory;

  @Column({
    type: 'enum',
    enum: ProcessingPurpose,
    nullable: false,
  })
  processingPurpose: ProcessingPurpose;

  @Column({
    type: 'enum',
    enum: LegalBasisUUPDP,
    nullable: false,
  })
  legalBasis: LegalBasisUUPDP;

  @Column({ type: 'int', nullable: false })
  retentionDays: number; // Periode retensi dalam hari

  @Column({ type: 'int', nullable: true })
  archivalDays: number; // Periode arsip sebelum penghapusan

  @Column({ type: 'boolean', default: false })
  requiresUserAction: boolean; // Perlu tindakan dari pengguna

  @Column({ type: 'boolean', default: false })
  automaticDeletion: boolean; // Penghapusan otomatis

  @Column({ type: 'boolean', default: false })
  anonymizationAllowed: boolean; // Diizinkan anonimisasi

  @Column({ type: 'varchar', length: 1000, nullable: true })
  retentionReason: string; // Alasan retensi

  @Column({ type: 'varchar', length: 1000, nullable: true })
  deletionCriteria: string; // Kriteria penghapusan

  @Column({ type: 'jsonb', nullable: true })
  policyDetails: {
    triggers: {
      type: 'time_based' | 'event_based' | 'user_action';
      condition: string;
      value: any;
    }[];
    exceptions: {
      condition: string;
      extendedRetentionDays: number;
      reason: string;
    }[];
    notifications: {
      daysBeforeExpiry: number[];
      notificationMethod: 'email' | 'in_app' | 'both';
      recipients: string[];
    };
    auditRequirements: {
      logLevel: 'basic' | 'detailed' | 'comprehensive';
      approvalRequired: boolean;
      reviewFrequency: number; // days
    };
  };

  @Column({ type: 'timestamp with time zone', nullable: true })
  effectiveDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expiryDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50, nullable: false, default: '1.0' })
  version: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  regulatoryBasis: string; // Dasar regulatori (UU PDP, Peraturan lainnya)
}

/**
 * Data Subject Rights Request - Permintaan hak subjek data sesuai UU PDP
 */
@Entity('privacy_data_subject_request')
@Index(['tenantId', 'userId', 'status', 'isDeleted'])
@Index(['tenantId', 'requestType', 'createdAt'])
export class DataSubjectRequest extends PrivacyAuditableEntity {
  @Column({ type: 'uuid', nullable: false })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  requestId: string; // ID unik untuk permintaan

  @Column({
    type: 'enum',
    enum: DataSubjectRight,
    nullable: false,
  })
  requestType: DataSubjectRight;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
    nullable: false,
  })
  status: RequestStatus;

  @Column({ type: 'text', nullable: true })
  requestDescription: string; // Deskripsi permintaan dari pengguna

  @Column({ type: 'varchar', length: 500, nullable: true })
  requestReason: string; // Alasan permintaan

  @Column({ type: 'timestamp with time zone', nullable: true })
  dueDate: Date; // Batas waktu penyelesaian (30 hari sesuai UU PDP)

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt: Date;

  @Column({ type: 'text', nullable: true })
  responseMessage: string; // Pesan respons kepada pengguna

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string; // Alasan penolakan jika ditolak

  @Column({ type: 'jsonb', nullable: true })
  requestDetails: {
    specificDataRequested: string[]; // Data spesifik yang diminta
    deliveryMethod: 'email' | 'download' | 'api' | 'physical';
    deliveryAddress?: string;
    fileFormat?: 'json' | 'csv' | 'xml' | 'pdf';
    encryptionRequired: boolean;
    urgentRequest: boolean;
    verificationDocuments: string[]; // Path ke dokumen verifikasi
    identityVerified: boolean;
    verificationMethod: 'email' | 'phone' | 'document' | 'in_person';
  };

  @Column({ type: 'jsonb', nullable: true })
  processingLog: {
    step: string;
    timestamp: Date;
    processedBy: string;
    status: string;
    notes: string;
    documentsGenerated?: string[];
    dataExtracted?: {
      tables: string[];
      recordCount: number;
      fileSize: number;
    };
  }[];

  @Column({ type: 'jsonb', nullable: true })
  fulfillmentDetails: {
    dataExported?: {
      exportDate: Date;
      fileNames: string[];
      filePaths: string[];
      downloadLinks?: string[];
      expiryDate: Date;
    };
    dataDeleted?: {
      deletionDate: Date;
      tablesAffected: string[];
      recordsDeleted: number;
      anonymizedFields: string[];
      retainedForLegal: string[];
    };
    dataUpdated?: {
      updateDate: Date;
      fieldsUpdated: string[];
      oldValues: Record<string, any>;
      newValues: Record<string, any>;
    };
  };

  @Column({ type: 'inet', nullable: true })
  requestorIp: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  requestorUserAgent: string;

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string; // Petugas yang menangani

  @Column({ type: 'varchar', length: 50, nullable: true })
  priority: string; // Priority: low, medium, high, urgent

  @Column({ type: 'varchar', length: 255, nullable: true })
  referenceNumber: string; // Nomor referensi untuk komunikasi dengan pengguna
}

/**
 * Privacy Breach Log - Log pelanggaran privasi sesuai UU PDP
 */
@Entity('privacy_breach_log')
@Index(['tenantId', 'severity', 'reportedAt'])
@Index(['tenantId', 'status', 'isDeleted'])
export class PrivacyBreachLog extends PrivacyAuditableEntity {
  @Column({ type: 'varchar', length: 100, nullable: false })
  breachId: string; // ID unik pelanggaran

  @Column({ type: 'varchar', length: 255, nullable: false })
  breachTitle: string;

  @Column({ type: 'text', nullable: false })
  breachDescription: string;

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'critical'],
    nullable: false,
  })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @Column({
    type: 'enum',
    enum: [
      'detected',
      'investigating',
      'contained',
      'resolved',
      'reported_to_authority',
    ],
    default: 'detected',
    nullable: false,
  })
  status:
    | 'detected'
    | 'investigating'
    | 'contained'
    | 'resolved'
    | 'reported_to_authority';

  @Column({ type: 'timestamp with time zone', nullable: false })
  detectedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  reportedAt: Date; // Waktu laporan ke otoritas

  @Column({ type: 'timestamp with time zone', nullable: true })
  containedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'jsonb', nullable: false })
  affectedData: {
    dataTypes: PersonalDataCategory[];
    estimatedRecordsAffected: number;
    confirmedRecordsAffected?: number;
    affectedUsers: string[]; // User IDs
    dataFields: string[];
    sensitiveDataInvolved: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  breachDetails: {
    causeOfBreach:
      | 'human_error'
      | 'system_failure'
      | 'malicious_attack'
      | 'unauthorized_access'
      | 'other';
    breachSource: 'internal' | 'external' | 'third_party' | 'unknown';
    accessMethod: string;
    vulnerabilityExploited?: string;
    affectedSystems: string[];
    dataLocation: 'local' | 'cloud' | 'backup' | 'archive' | 'in_transit';
    encryptionStatus: 'encrypted' | 'unencrypted' | 'partially_encrypted';
  };

  @Column({ type: 'jsonb', nullable: true })
  responseActions: {
    immediateActions: {
      action: string;
      timestamp: Date;
      performedBy: string;
      outcome: string;
    }[];
    investigationSteps: {
      step: string;
      timestamp: Date;
      assignedTo: string;
      findings: string;
      evidenceCollected?: string[];
    }[];
    remediationMeasures: {
      measure: string;
      implementedAt: Date;
      responsibleParty: string;
      effectiveness:
        | 'effective'
        | 'partially_effective'
        | 'ineffective'
        | 'pending_assessment';
    }[];
    preventiveMeasures: {
      measure: string;
      timeline: string;
      responsibleParty: string;
      status: 'planned' | 'in_progress' | 'completed';
    }[];
  };

  @Column({ type: 'jsonb', nullable: true })
  notifications: {
    authorityNotification?: {
      notifiedAt: Date;
      authorityName: string;
      referenceNumber: string;
      method: string;
      acknowledgedAt?: Date;
    };
    userNotifications: {
      userId: string;
      notifiedAt: Date;
      method: 'email' | 'sms' | 'in_app' | 'letter';
      acknowledgedAt?: Date;
      optedOut?: boolean;
    }[];
    mediaNotification?: {
      required: boolean;
      publishedAt?: Date;
      outlets: string[];
    };
  };

  @Column({ type: 'text', nullable: true })
  lessonsLearned: string;

  @Column({ type: 'text', nullable: true })
  improvementActions: string;

  @Column({ type: 'uuid', nullable: true })
  investigationLead: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalReference: string; // Referensi dari otoritas atau pihak ketiga
}

/**
 * Data Processing Activity - Catatan aktivitas pemrosesan sesuai UU PDP
 */
@Entity('privacy_processing_activity')
@Index(['tenantId', 'isActive', 'isDeleted'])
export class DataProcessingActivity extends PrivacyAuditableEntity {
  @Column({ type: 'varchar', length: 255, nullable: false })
  activityName: string;

  @Column({ type: 'text', nullable: false })
  activityDescription: string;

  @Column({
    type: 'enum',
    enum: ProcessingPurpose,
    array: true,
    nullable: false,
  })
  processingPurposes: ProcessingPurpose[];

  @Column({
    type: 'enum',
    enum: LegalBasisUUPDP,
    nullable: false,
  })
  legalBasis: LegalBasisUUPDP;

  @Column({
    type: 'enum',
    enum: PersonalDataCategory,
    array: true,
    nullable: false,
  })
  dataCategories: PersonalDataCategory[];

  @Column({ type: 'varchar', length: 500, nullable: false })
  dataController: string; // Pengendali data

  @Column({ type: 'varchar', length: 500, nullable: true })
  dataProcessor: string; // Pemroses data

  @Column({ type: 'varchar', length: 500, nullable: true })
  jointControllers: string; // Pengendali bersama

  @Column({ type: 'jsonb', nullable: false })
  dataSubjects: {
    categories: (
      | 'customers'
      | 'employees'
      | 'suppliers'
      | 'visitors'
      | 'minors'
      | 'other'
    )[];
    estimatedNumber: number;
    description: string;
  };

  @Column({ type: 'jsonb', nullable: false })
  processingDetails: {
    automated: boolean;
    profiling: boolean;
    decisionMaking: boolean;
    crossBorderTransfer: boolean;
    transferCountries?: string[];
    transferSafeguards?: string;
    retentionPeriod: string;
    technicalMeasures: string[];
    organizationalMeasures: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  thirdParties: {
    name: string;
    role: 'processor' | 'joint_controller' | 'recipient';
    country: string;
    dataShared: PersonalDataCategory[];
    safeguards: string[];
    contractualProtections: string[];
  }[];

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastReviewDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  nextReviewDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dpoContact: string; // Data Protection Officer contact

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50, nullable: false, default: '1.0' })
  version: string;
}
