import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, In, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';

import {
  DataRetentionPolicy,
  DataClassification,
  PersonalDataCategory,
  ProcessingPurpose,
  LegalBasisUUPDP,
} from '../entities/privacy-management.entity';
import { SOC2AuditLogService } from './soc2-audit-log.service';
import { AuditEventType, AuditEventOutcome, AuditEventSeverity } from '../entities/soc2-audit-log.entity';

export interface RetentionPolicyDto {
  policyName: string;
  description: string;
  dataCategory: PersonalDataCategory;
  processingPurpose: ProcessingPurpose;
  legalBasis: LegalBasisUUPDP;
  retentionDays: number;
  archivalDays?: number;
  requiresUserAction?: boolean;
  automaticDeletion?: boolean;
  anonymizationAllowed?: boolean;
  retentionReason: string;
  deletionCriteria?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  policyDetails?: {
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
      reviewFrequency: number;
    };
  };
}

export interface DataLifecycleStatus {
  entityName: string;
  recordId: string;
  createdAt: Date;
  retentionPolicy: string;
  expiryDate: Date;
  daysToExpiry: number;
  status: 'active' | 'expiring_soon' | 'expired' | 'archived' | 'deleted';
  actions: {
    archiveEligible: boolean;
    deleteEligible: boolean;
    anonymizeEligible: boolean;
    requiresApproval: boolean;
  };
}

export interface RetentionReport {
  reportDate: Date;
  tenantId: string;
  summary: {
    totalRecords: number;
    recordsByCategory: Record<PersonalDataCategory, number>;
    recordsByStatus: Record<string, number>;
    policiesApplied: number;
    automatedActions: number;
    manualReviewRequired: number;
  };
  expiringRecords: {
    in7Days: DataLifecycleStatus[];
    in30Days: DataLifecycleStatus[];
    overdue: DataLifecycleStatus[];
  };
  retentionMetrics: {
    averageRetentionDays: number;
    complianceRate: number;
    automationRate: number;
    dataCategoriesManaged: PersonalDataCategory[];
  };
  recommendations: string[];
}

export interface ArchivalResult {
  archivalId: string;
  archivalDate: Date;
  recordsArchived: number;
  tablesAffected: string[];
  archiveLocation: string;
  originalDataRemoved: boolean;
  verificationHash: string;
}

export interface PurgeResult {
  purgeId: string;
  purgeDate: Date;
  recordsPurged: number;
  recordsAnonymized: number;
  tablesAffected: string[];
  retentionExceptions: {
    recordId: string;
    reason: string;
    extendedUntil: Date;
  }[];
}

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(DataRetentionPolicy)
    private readonly retentionPolicyRepository: Repository<DataRetentionPolicy>,
    @InjectRepository(DataClassification)
    private readonly dataClassificationRepository: Repository<DataClassification>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogService: SOC2AuditLogService,
  ) {}

  /**
   * Create a new data retention policy
   */
  async createRetentionPolicy(
    tenantId: string,
    policy: RetentionPolicyDto,
    createdBy: string,
  ): Promise<DataRetentionPolicy> {
    try {
      const retentionPolicy = this.retentionPolicyRepository.create({
        tenantId,
        ...policy,
        effectiveDate: policy.effectiveDate || new Date(),
        isActive: true,
        version: '1.0',
        createdBy,
      });

      const savedPolicy = await this.retentionPolicyRepository.save(retentionPolicy);

      // Emit policy created event
      this.eventEmitter.emit('privacy.retention_policy.created', {
        tenantId,
        policyId: savedPolicy.id,
        dataCategory: policy.dataCategory,
        processingPurpose: policy.processingPurpose,
        retentionDays: policy.retentionDays,
        automaticDeletion: policy.automaticDeletion,
        createdBy,
        timestamp: new Date(),
      });

      // Log to audit trail
      await this.auditLogService.logEvent(tenantId, {
        eventType: AuditEventType.SYSTEM_CONFIG_CHANGE,
        eventDescription: `Data retention policy created: ${policy.policyName}`,
        severity: AuditEventSeverity.MEDIUM,
        outcome: AuditEventOutcome.SUCCESS,
        resourceType: 'data_retention_policy',
        resourceId: savedPolicy.id,
        sourceSystem: 'Privacy Management',
        sourceModule: 'Data Retention',
        additionalData: {
          policyName: policy.policyName,
          dataCategory: policy.dataCategory,
          retentionDays: policy.retentionDays,
          automaticDeletion: policy.automaticDeletion,
        },
      });

      this.logger.log(`Data retention policy created: ${savedPolicy.id}`);
      return savedPolicy;

    } catch (error) {
      this.logger.error(`Error creating retention policy: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to create retention policy');
    }
  }

  /**
   * Get retention policies with filtering
   */
  async getRetentionPolicies(
    tenantId: string,
    filters?: {
      dataCategory?: PersonalDataCategory;
      processingPurpose?: ProcessingPurpose;
      isActive?: boolean;
      expiringSoon?: boolean;
    },
  ): Promise<DataRetentionPolicy[]> {
    try {
      const where: FindOptionsWhere<DataRetentionPolicy> = {
        tenantId,
        isDeleted: false,
      };

      if (filters?.dataCategory) {
        where.dataCategory = filters.dataCategory;
      }

      if (filters?.processingPurpose) {
        where.processingPurpose = filters.processingPurpose;
      }

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters?.expiringSoon) {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        where.expiryDate = Between(new Date(), thirtyDaysFromNow);
      }

      return await this.retentionPolicyRepository.find({
        where,
        order: { createdAt: 'DESC' },
      });

    } catch (error) {
      this.logger.error(`Error getting retention policies: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to retrieve retention policies');
    }
  }

  /**
   * Analyze data lifecycle status for a tenant
   */
  async analyzeDataLifecycle(tenantId: string): Promise<DataLifecycleStatus[]> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const lifecycleStatuses: DataLifecycleStatus[] = [];

      try {
        // Get all active data classifications
        const dataClassifications = await this.dataClassificationRepository.find({
          where: { tenantId, isActive: true, isDeleted: false },
        });

        // Get applicable retention policies
        const retentionPolicies = await this.getRetentionPolicies(tenantId, { isActive: true });

        for (const classification of dataClassifications) {
          // Find applicable retention policy
          const applicablePolicy = retentionPolicies.find(policy =>
            policy.dataCategory === classification.category &&
            policy.processingPurpose === classification.processingPurposes[0] // Using first purpose
          );

          if (!applicablePolicy) continue;

          // Query records for this classification
          const records = await queryRunner.query(`
            SELECT id, created_at, updated_at 
            FROM ${classification.entityName} 
            WHERE tenant_id = $1 AND is_deleted = false
          `, [tenantId]);

          for (const record of records) {
            const createdAt = new Date(record.created_at);
            const expiryDate = new Date(createdAt);
            expiryDate.setDate(expiryDate.getDate() + applicablePolicy.retentionDays);

            const daysToExpiry = Math.ceil(
              (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );

            let status: DataLifecycleStatus['status'] = 'active';
            if (daysToExpiry <= 0) {
              status = 'expired';
            } else if (daysToExpiry <= 30) {
              status = 'expiring_soon';
            }

            lifecycleStatuses.push({
              entityName: classification.entityName,
              recordId: record.id,
              createdAt,
              retentionPolicy: applicablePolicy.policyName,
              expiryDate,
              daysToExpiry,
              status,
              actions: {
                archiveEligible: applicablePolicy.archivalDays ? daysToExpiry <= 0 : false,
                deleteEligible: applicablePolicy.automaticDeletion && daysToExpiry <= 0,
                anonymizeEligible: applicablePolicy.anonymizationAllowed && daysToExpiry <= 0,
                requiresApproval: applicablePolicy.policyDetails?.auditRequirements.approvalRequired || false,
              },
            });
          }
        }

        return lifecycleStatuses;

      } finally {
        await queryRunner.release();
      }

    } catch (error) {
      this.logger.error(`Error analyzing data lifecycle: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to analyze data lifecycle');
    }
  }

  /**
   * Generate comprehensive retention report
   */
  async generateRetentionReport(
    tenantId: string,
    includePredictions?: boolean,
  ): Promise<RetentionReport> {
    try {
      const lifecycleStatuses = await this.analyzeDataLifecycle(tenantId);
      const retentionPolicies = await this.getRetentionPolicies(tenantId, { isActive: true });

      // Calculate summary statistics
      const totalRecords = lifecycleStatuses.length;
      const recordsByCategory: Record<PersonalDataCategory, number> = {} as any;
      const recordsByStatus: Record<string, number> = {};

      Object.values(PersonalDataCategory).forEach(category => {
        recordsByCategory[category] = 0;
      });

      lifecycleStatuses.forEach(status => {
        // Count by status
        recordsByStatus[status.status] = (recordsByStatus[status.status] || 0) + 1;
      });

      // Categorize expiring records
      const expiringRecords = {
        in7Days: lifecycleStatuses.filter(s => s.daysToExpiry >= 0 && s.daysToExpiry <= 7),
        in30Days: lifecycleStatuses.filter(s => s.daysToExpiry >= 8 && s.daysToExpiry <= 30),
        overdue: lifecycleStatuses.filter(s => s.daysToExpiry < 0),
      };

      // Calculate metrics
      const automatedActions = lifecycleStatuses.filter(s => s.actions.deleteEligible).length;
      const manualReviewRequired = lifecycleStatuses.filter(s => s.actions.requiresApproval).length;

      const retentionDays = lifecycleStatuses.map(s => s.daysToExpiry);
      const averageRetentionDays = retentionDays.length > 0 
        ? retentionDays.reduce((sum, days) => sum + days, 0) / retentionDays.length 
        : 0;

      const expiredRecords = lifecycleStatuses.filter(s => s.status === 'expired').length;
      const complianceRate = totalRecords > 0 ? ((totalRecords - expiredRecords) / totalRecords) * 100 : 100;

      const automationRate = totalRecords > 0 ? (automatedActions / totalRecords) * 100 : 0;

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (complianceRate < 95) {
        recommendations.push('Consider implementing automated retention enforcement to improve compliance rate');
      }
      
      if (expiringRecords.overdue.length > 0) {
        recommendations.push(`${expiringRecords.overdue.length} records are overdue for retention action`);
      }
      
      if (automationRate < 50) {
        recommendations.push('Consider increasing automation in retention policies to reduce manual overhead');
      }
      
      if (retentionPolicies.length === 0) {
        recommendations.push('No active retention policies found - consider implementing data lifecycle management');
      }

      return {
        reportDate: new Date(),
        tenantId,
        summary: {
          totalRecords,
          recordsByCategory,
          recordsByStatus,
          policiesApplied: retentionPolicies.length,
          automatedActions,
          manualReviewRequired,
        },
        expiringRecords,
        retentionMetrics: {
          averageRetentionDays,
          complianceRate,
          automationRate,
          dataCategoriesManaged: Object.values(PersonalDataCategory),
        },
        recommendations,
      };

    } catch (error) {
      this.logger.error(`Error generating retention report: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to generate retention report');
    }
  }

  /**
   * Archive expired data
   */
  async archiveExpiredData(
    tenantId: string,
    policyId?: string,
    dryRun: boolean = false,
  ): Promise<ArchivalResult> {
    try {
      const archivalId = crypto.randomUUID();
      const archivalDate = new Date();
      let recordsArchived = 0;
      const tablesAffected: string[] = [];

      const queryRunner = this.dataSource.createQueryRunner();
      
      if (!dryRun) {
        await queryRunner.startTransaction();
      }

      try {
        // Get retention policies to apply
        const policies = policyId 
          ? [await this.retentionPolicyRepository.findOne({ where: { id: policyId, tenantId } })]
          : await this.getRetentionPolicies(tenantId, { isActive: true });

        for (const policy of policies.filter(Boolean)) {
          if (!policy!.archivalDays) continue;

          // Find records eligible for archival
          const dataClassifications = await this.dataClassificationRepository.find({
            where: {
              tenantId,
              category: policy!.dataCategory,
              isActive: true,
              isDeleted: false,
            },
          });

          for (const classification of dataClassifications) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - policy!.retentionDays);

            if (!dryRun) {
              // Move data to archive table (simplified - real implementation would be more sophisticated)
              const archiveResult = await queryRunner.query(`
                INSERT INTO ${classification.entityName}_archive 
                SELECT *, $1 as archived_at, $2 as archival_id
                FROM ${classification.entityName}
                WHERE tenant_id = $3 AND created_at < $4 AND is_deleted = false
              `, [archivalDate, archivalId, tenantId, cutoffDate]);

              recordsArchived += archiveResult.affectedRows || 0;

              // Mark original records as archived
              await queryRunner.query(`
                UPDATE ${classification.entityName}
                SET is_deleted = true, deleted_at = $1, deleted_by = 'system_archival'
                WHERE tenant_id = $2 AND created_at < $3 AND is_deleted = false
              `, [archivalDate, tenantId, cutoffDate]);

              if (!tablesAffected.includes(classification.entityName)) {
                tablesAffected.push(classification.entityName);
              }
            }
          }
        }

        if (!dryRun) {
          await queryRunner.commitTransaction();
        }

        // Generate verification hash
        const verificationData = {
          archivalId,
          tenantId,
          recordsArchived,
          tablesAffected,
          archivalDate: archivalDate.toISOString(),
        };
        const verificationHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(verificationData))
          .digest('hex');

        const result: ArchivalResult = {
          archivalId,
          archivalDate,
          recordsArchived,
          tablesAffected,
          archiveLocation: `archive_${tenantId}_${archivalId}`,
          originalDataRemoved: !dryRun,
          verificationHash,
        };

        if (!dryRun) {
          // Emit archival event
          this.eventEmitter.emit('privacy.data_archival.completed', {
            tenantId,
            archivalId,
            recordsArchived,
            tablesAffected,
            archivalDate,
          });

          // Log to audit trail
          await this.auditLogService.logEvent(tenantId, {
            eventType: AuditEventType.DATA_EXPORT,
            eventDescription: `Data archival completed: ${recordsArchived} records archived`,
            severity: AuditEventSeverity.MEDIUM,
            outcome: AuditEventOutcome.SUCCESS,
            resourceType: 'data_archival',
            resourceId: archivalId,
            sourceSystem: 'Privacy Management',
            sourceModule: 'Data Retention',
            additionalData: {
              archivalId,
              recordsArchived,
              tablesAffected,
              verificationHash,
            },
          });
        }

        return result;

      } catch (error) {
        if (!dryRun) {
          await queryRunner.rollbackTransaction();
        }
        throw error;
      } finally {
        await queryRunner.release();
      }

    } catch (error) {
      this.logger.error(`Error archiving data: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to archive expired data');
    }
  }

  /**
   * Purge expired data permanently
   */
  async purgeExpiredData(
    tenantId: string,
    policyId?: string,
    confirmationToken?: string,
    dryRun: boolean = false,
  ): Promise<PurgeResult> {
    try {
      // Verify confirmation token for security
      if (!dryRun && !confirmationToken) {
        throw new BadRequestException('Confirmation token required for data purging');
      }

      const purgeId = crypto.randomUUID();
      const purgeDate = new Date();
      let recordsPurged = 0;
      let recordsAnonymized = 0;
      const tablesAffected: string[] = [];
      const retentionExceptions: PurgeResult['retentionExceptions'] = [];

      const queryRunner = this.dataSource.createQueryRunner();
      
      if (!dryRun) {
        await queryRunner.startTransaction();
      }

      try {
        // Get retention policies to apply
        const policies = policyId 
          ? [await this.retentionPolicyRepository.findOne({ where: { id: policyId, tenantId } })]
          : await this.getRetentionPolicies(tenantId, { isActive: true });

        for (const policy of policies.filter(Boolean)) {
          if (!policy!.automaticDeletion) continue;

          // Find records eligible for purging
          const dataClassifications = await this.dataClassificationRepository.find({
            where: {
              tenantId,
              category: policy!.dataCategory,
              isActive: true,
              isDeleted: false,
            },
          });

          for (const classification of dataClassifications) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - policy!.retentionDays);

            // Check for retention exceptions
            const exceptions = await this.checkRetentionExceptions(
              queryRunner,
              classification.entityName,
              tenantId,
              cutoffDate,
            );

            exceptions.forEach(exception => {
              retentionExceptions.push(exception);
            });

            if (!dryRun) {
              if (policy!.anonymizationAllowed) {
                // Anonymize instead of delete
                const anonymizeResult = await this.anonymizeExpiredRecords(
                  queryRunner,
                  classification.entityName,
                  tenantId,
                  cutoffDate,
                  exceptions.map(e => e.recordId),
                );
                recordsAnonymized += anonymizeResult;
              } else {
                // Permanently delete records
                const deleteResult = await queryRunner.query(`
                  DELETE FROM ${classification.entityName}
                  WHERE tenant_id = $1 AND created_at < $2 
                    AND id NOT IN (${exceptions.map((_, i) => `$${i + 3}`).join(',') || 'NULL'})
                `, [tenantId, cutoffDate, ...exceptions.map(e => e.recordId)]);

                recordsPurged += deleteResult.affectedRows || 0;
              }

              if (!tablesAffected.includes(classification.entityName)) {
                tablesAffected.push(classification.entityName);
              }
            }
          }
        }

        if (!dryRun) {
          await queryRunner.commitTransaction();
        }

        const result: PurgeResult = {
          purgeId,
          purgeDate,
          recordsPurged,
          recordsAnonymized,
          tablesAffected,
          retentionExceptions,
        };

        if (!dryRun) {
          // Emit purge event
          this.eventEmitter.emit('privacy.data_purge.completed', {
            tenantId,
            purgeId,
            recordsPurged,
            recordsAnonymized,
            tablesAffected,
            purgeDate,
          });

          // Log to audit trail
          await this.auditLogService.logEvent(tenantId, {
            eventType: AuditEventType.DATA_DELETE,
            eventDescription: `Data purge completed: ${recordsPurged} records deleted, ${recordsAnonymized} anonymized`,
            severity: AuditEventSeverity.HIGH,
            outcome: AuditEventOutcome.SUCCESS,
            resourceType: 'data_purge',
            resourceId: purgeId,
            sourceSystem: 'Privacy Management',
            sourceModule: 'Data Retention',
            additionalData: {
              purgeId,
              recordsPurged,
              recordsAnonymized,
              tablesAffected,
              retentionExceptions: retentionExceptions.length,
            },
          });
        }

        return result;

      } catch (error) {
        if (!dryRun) {
          await queryRunner.rollbackTransaction();
        }
        throw error;
      } finally {
        await queryRunner.release();
      }

    } catch (error) {
      this.logger.error(`Error purging data: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to purge expired data');
    }
  }

  /**
   * Automated daily retention check
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async performDailyRetentionCheck(): Promise<void> {
    try {
      this.logger.log('Starting daily data retention check...');

      // Get all tenants with active retention policies
      const activePolicies = await this.retentionPolicyRepository.find({
        where: { isActive: true, isDeleted: false },
        select: ['tenantId'],
      });

      const uniqueTenants = [...new Set(activePolicies.map(p => p.tenantId))];

      for (const tenantId of uniqueTenants) {
        try {
          // Generate retention report
          const report = await this.generateRetentionReport(tenantId);

          // Emit daily retention report event
          this.eventEmitter.emit('privacy.retention.daily_report', {
            tenantId,
            report,
            timestamp: new Date(),
          });

          // Check for overdue records and send alerts
          if (report.expiringRecords.overdue.length > 0) {
            this.eventEmitter.emit('privacy.retention.overdue_alert', {
              tenantId,
              overdueCount: report.expiringRecords.overdue.length,
              overdueRecords: report.expiringRecords.overdue.slice(0, 10), // First 10 for alert
              timestamp: new Date(),
            });
          }

          // Auto-archive eligible data
          const archivePolicies = await this.getRetentionPolicies(tenantId, { isActive: true });
          const autoArchivePolicies = archivePolicies.filter(p => 
            p.archivalDays && 
            p.policyDetails?.auditRequirements.approvalRequired === false
          );

          for (const policy of autoArchivePolicies) {
            await this.archiveExpiredData(tenantId, policy.id, false);
          }

          // Auto-delete eligible data
          const autoPurgePolicies = archivePolicies.filter(p => 
            p.automaticDeletion && 
            p.policyDetails?.auditRequirements.approvalRequired === false
          );

          for (const policy of autoPurgePolicies) {
            const confirmationToken = crypto.randomUUID(); // Generate for automated process
            await this.purgeExpiredData(tenantId, policy.id, confirmationToken, false);
          }

        } catch (error) {
          this.logger.error(`Error in daily retention check for tenant ${tenantId}: ${error.message}`);
        }
      }

      this.logger.log('Daily data retention check completed');

    } catch (error) {
      this.logger.error(`Error during daily retention check: ${error.message}`, error.stack);
    }
  }

  /**
   * Send retention policy expiry reminders
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async sendRetentionPolicyReminders(): Promise<void> {
    try {
      this.logger.log('Checking for retention policy expiry reminders...');

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringPolicies = await this.retentionPolicyRepository.find({
        where: {
          isActive: true,
          expiryDate: Between(new Date(), thirtyDaysFromNow),
          isDeleted: false,
        },
      });

      for (const policy of expiringPolicies) {
        const daysToExpiry = Math.ceil(
          (policy.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if ([30, 14, 7, 1].includes(daysToExpiry)) {
          this.eventEmitter.emit('privacy.retention_policy.expiry_reminder', {
            tenantId: policy.tenantId,
            policyId: policy.id,
            policyName: policy.policyName,
            daysToExpiry,
            expiryDate: policy.expiryDate,
            dataCategory: policy.dataCategory,
            processingPurpose: policy.processingPurpose,
          });
        }
      }

      this.logger.log(`Sent expiry reminders for ${expiringPolicies.length} retention policies`);

    } catch (error) {
      this.logger.error(`Error sending retention policy reminders: ${error.message}`, error.stack);
    }
  }

  // Private helper methods

  private async checkRetentionExceptions(
    queryRunner: any,
    tableName: string,
    tenantId: string,
    cutoffDate: Date,
  ): Promise<Array<{ recordId: string; reason: string; extendedUntil: Date }>> {
    // Check for legal hold, ongoing investigations, etc.
    // This is a simplified implementation - real version would check various exception conditions
    return [];
  }

  private async anonymizeExpiredRecords(
    queryRunner: any,
    tableName: string,
    tenantId: string,
    cutoffDate: Date,
    exceptions: string[] = [],
  ): Promise<number> {
    // Anonymize sensitive fields while preserving data structure for analytics
    const anonymizedData = {
      email: `anonymized_${crypto.randomUUID()}@example.com`,
      name: 'Anonymized User',
      phone: 'ANONYMIZED',
      // Add other fields based on data classification
    };

    const setClause = Object.keys(anonymizedData)
      .map((key, index) => `${key} = $${index + 4}`)
      .join(', ');

    const values = [
      new Date(), // updated_at
      'system_anonymization', // updated_by
      tenantId,
      cutoffDate,
      ...Object.values(anonymizedData),
    ];

    const result = await queryRunner.query(`
      UPDATE ${tableName} 
      SET ${setClause}, updated_at = $1, updated_by = $2
      WHERE tenant_id = $3 AND created_at < $4 
        ${exceptions.length > 0 ? `AND id NOT IN (${exceptions.map((_, i) => `$${i + 5}`).join(',')})` : ''}
    `, [...values, ...exceptions]);

    return result.affectedRows || 0;
  }
}