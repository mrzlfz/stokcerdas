import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  PrivacyConsent,
  ConsentStatus,
  ProcessingPurpose,
  LegalBasisUUPDP,
} from '../entities/privacy-management.entity';
import { User } from '../../users/entities/user.entity';
import { SOC2AuditLogService } from './soc2-audit-log.service';
import { AuditEventType, AuditEventOutcome, AuditEventSeverity } from '../entities/soc2-audit-log.entity';

export interface ConsentRequestDto {
  userId: string;
  purpose: ProcessingPurpose;
  consentText: string;
  consentTextEn?: string;
  version: string;
  expiryDays?: number;
  ipAddress?: string;
  userAgent?: string;
  granularConsents?: {
    purpose: ProcessingPurpose;
    consented: boolean;
  }[];
  isMinor?: boolean;
  legalGuardian?: string;
  parentalConsent?: {
    parentName: string;
    parentEmail: string;
    verificationMethod: string;
  };
}

export interface ConsentWithdrawalDto {
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConsentQueryParams {
  userId?: string;
  purpose?: ProcessingPurpose;
  status?: ConsentStatus;
  isExpiring?: boolean; // Consents expiring within 30 days
  isMinor?: boolean;
  startDate?: Date;
  endDate?: Date;
  includeWithdrawn?: boolean;
  limit?: number;
  offset?: number;
}

export interface ConsentAnalytics {
  totalConsents: number;
  activeConsents: number;
  withdrawnConsents: number;
  expiredConsents: number;
  pendingConsents: number;
  consentsByPurpose: Record<ProcessingPurpose, {
    total: number;
    active: number;
    withdrawalRate: number;
  }>;
  consentTrends: {
    date: Date;
    given: number;
    withdrawn: number;
    expired: number;
  }[];
  complianceMetrics: {
    averageResponseTime: number; // hours
    timesToExpiry: number[]; // days
    renewalRate: number; // percentage
    minorConsentsCount: number;
  };
  riskIndicators: {
    expiringConsents: number;
    outdatedVersions: number;
    invalidConsents: number;
    highWithdrawalPurposes: ProcessingPurpose[];
  };
}

@Injectable()
export class PrivacyConsentService {
  private readonly logger = new Logger(PrivacyConsentService.name);

  constructor(
    @InjectRepository(PrivacyConsent)
    private readonly consentRepository: Repository<PrivacyConsent>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogService: SOC2AuditLogService,
  ) {}

  /**
   * Collect consent from user
   */
  async collectConsent(
    tenantId: string,
    request: ConsentRequestDto,
    collectedBy: string,
  ): Promise<PrivacyConsent> {
    try {
      // Check for existing active consent
      const existingConsent = await this.consentRepository.findOne({
        where: {
          tenantId,
          userId: request.userId,
          purpose: request.purpose,
          status: In([ConsentStatus.GIVEN, ConsentStatus.PENDING]),
          isDeleted: false,
        },
      });

      if (existingConsent) {
        // Update existing consent instead of creating new one
        return this.updateExistingConsent(existingConsent, request, collectedBy);
      }

      // Calculate expiry date (default 2 years for UU PDP compliance)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (request.expiryDays || 730));

      const consent = this.consentRepository.create({
        tenantId,
        userId: request.userId,
        purpose: request.purpose,
        status: ConsentStatus.GIVEN,
        consentText: request.consentText,
        consentTextEn: request.consentTextEn,
        givenAt: new Date(),
        expiryDate,
        version: request.version,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        isMinor: request.isMinor || false,
        legalGuardian: request.legalGuardian,
        consentDetails: {
          granularConsents: request.granularConsents?.map(gc => ({
            ...gc,
            timestamp: new Date(),
          })) || [],
          consentMethod: 'explicit',
          evidenceType: 'digital_signature',
          renewalRequired: true,
          childConsent: request.isMinor || false,
          parentalConsent: request.parentalConsent,
        },
        auditTrail: [{
          action: 'given',
          timestamp: new Date(),
          userId: collectedBy,
          ipAddress: request.ipAddress || '',
          userAgent: request.userAgent || '',
          details: {
            version: request.version,
            purpose: request.purpose,
            expiryDate,
          },
        }],
        createdBy: collectedBy,
      });

      const savedConsent = await this.consentRepository.save(consent);

      // Emit consent given event
      this.eventEmitter.emit('privacy.consent.given', {
        tenantId,
        userId: request.userId,
        purpose: request.purpose,
        consentId: savedConsent.id,
        isMinor: request.isMinor,
        timestamp: new Date(),
      });

      // Log to audit trail
      await this.auditLogService.logEvent(tenantId, {
        eventType: AuditEventType.USER_CREATED, // Using closest available type
        eventDescription: `Privacy consent collected for purpose: ${request.purpose}`,
        severity: AuditEventSeverity.MEDIUM,
        outcome: AuditEventOutcome.SUCCESS,
        userId: request.userId,
        resourceType: 'privacy_consent',
        resourceId: savedConsent.id,
        sourceSystem: 'Privacy Management',
        sourceModule: 'Consent Collection',
        additionalData: {
          purpose: request.purpose,
          isMinor: request.isMinor,
          hasParentalConsent: !!request.parentalConsent,
          version: request.version,
        },
      });

      this.logger.log(`Consent collected for user ${request.userId}, purpose: ${request.purpose}`);
      return savedConsent;

    } catch (error) {
      this.logger.error(`Error collecting consent: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to collect consent');
    }
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    tenantId: string,
    userId: string,
    purpose: ProcessingPurpose,
    withdrawal: ConsentWithdrawalDto,
    withdrawnBy: string,
  ): Promise<PrivacyConsent> {
    try {
      const consent = await this.consentRepository.findOne({
        where: {
          tenantId,
          userId,
          purpose,
          status: ConsentStatus.GIVEN,
          isDeleted: false,
        },
      });

      if (!consent) {
        throw new NotFoundException('Active consent not found for withdrawal');
      }

      // Update consent status
      consent.status = ConsentStatus.WITHDRAWN;
      consent.withdrawnAt = new Date();
      consent.withdrawalReason = withdrawal.reason;
      consent.updatedBy = withdrawnBy;

      // Add to audit trail
      const auditEntry = {
        action: 'withdrawn' as const,
        timestamp: new Date(),
        userId: withdrawnBy,
        ipAddress: withdrawal.ipAddress || '',
        userAgent: withdrawal.userAgent || '',
        details: {
          reason: withdrawal.reason,
          purpose,
        },
      };

      consent.auditTrail = [...(consent.auditTrail || []), auditEntry];

      const updatedConsent = await this.consentRepository.save(consent);

      // Emit consent withdrawn event
      this.eventEmitter.emit('privacy.consent.withdrawn', {
        tenantId,
        userId,
        purpose,
        consentId: consent.id,
        reason: withdrawal.reason,
        timestamp: new Date(),
      });

      // Log to audit trail
      await this.auditLogService.logEvent(tenantId, {
        eventType: AuditEventType.USER_UPDATED,
        eventDescription: `Privacy consent withdrawn for purpose: ${purpose}`,
        severity: AuditEventSeverity.MEDIUM,
        outcome: AuditEventOutcome.SUCCESS,
        userId,
        resourceType: 'privacy_consent',
        resourceId: consent.id,
        sourceSystem: 'Privacy Management',
        sourceModule: 'Consent Withdrawal',
        additionalData: {
          purpose,
          reason: withdrawal.reason,
          withdrawnBy,
        },
      });

      this.logger.log(`Consent withdrawn for user ${userId}, purpose: ${purpose}`);
      return updatedConsent;

    } catch (error) {
      this.logger.error(`Error withdrawing consent: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException('Failed to withdraw consent');
    }
  }

  /**
   * Get user's consent status
   */
  async getUserConsents(
    tenantId: string,
    userId: string,
    includePurposes?: ProcessingPurpose[],
  ): Promise<PrivacyConsent[]> {
    try {
      const where: FindOptionsWhere<PrivacyConsent> = {
        tenantId,
        userId,
        isDeleted: false,
      };

      if (includePurposes?.length) {
        where.purpose = In(includePurposes);
      }

      return await this.consentRepository.find({
        where,
        order: { createdAt: 'DESC' },
      });

    } catch (error) {
      this.logger.error(`Error getting user consents: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to retrieve user consents');
    }
  }

  /**
   * Check if user has valid consent for purpose
   */
  async hasValidConsent(
    tenantId: string,
    userId: string,
    purpose: ProcessingPurpose,
  ): Promise<boolean> {
    try {
      const consent = await this.consentRepository.findOne({
        where: {
          tenantId,
          userId,
          purpose,
          status: ConsentStatus.GIVEN,
          isDeleted: false,
        },
      });

      if (!consent) return false;

      // Check if consent has expired
      if (consent.expiryDate && consent.expiryDate < new Date()) {
        await this.expireConsent(consent);
        return false;
      }

      return true;

    } catch (error) {
      this.logger.error(`Error checking consent validity: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Query consents with filters
   */
  async queryConsents(
    tenantId: string,
    params: ConsentQueryParams,
  ): Promise<{
    consents: PrivacyConsent[];
    total: number;
  }> {
    try {
      const where: FindOptionsWhere<PrivacyConsent> = {
        tenantId,
        isDeleted: false,
      };

      if (params.userId) {
        where.userId = params.userId;
      }

      if (params.purpose) {
        where.purpose = params.purpose;
      }

      if (params.status) {
        where.status = params.status;
      } else if (!params.includeWithdrawn) {
        where.status = In([ConsentStatus.GIVEN, ConsentStatus.PENDING, ConsentStatus.EXPIRED]);
      }

      if (params.isMinor !== undefined) {
        where.isMinor = params.isMinor;
      }

      if (params.startDate || params.endDate) {
        where.createdAt = Between(
          params.startDate || new Date(0),
          params.endDate || new Date(),
        );
      }

      // Handle expiring consents
      if (params.isExpiring) {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        where.expiryDate = Between(new Date(), thirtyDaysFromNow);
        where.status = ConsentStatus.GIVEN;
      }

      const [consents, total] = await this.consentRepository.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        take: params.limit || 100,
        skip: params.offset || 0,
      });

      return { consents, total };

    } catch (error) {
      this.logger.error(`Error querying consents: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to query consents');
    }
  }

  /**
   * Generate consent analytics
   */
  async generateConsentAnalytics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ConsentAnalytics> {
    try {
      const where: FindOptionsWhere<PrivacyConsent> = {
        tenantId,
        isDeleted: false,
      };

      if (startDate || endDate) {
        where.createdAt = Between(
          startDate || new Date(0),
          endDate || new Date(),
        );
      }

      const allConsents = await this.consentRepository.find({ where });

      const totalConsents = allConsents.length;
      const activeConsents = allConsents.filter(c => c.status === ConsentStatus.GIVEN).length;
      const withdrawnConsents = allConsents.filter(c => c.status === ConsentStatus.WITHDRAWN).length;
      const expiredConsents = allConsents.filter(c => c.status === ConsentStatus.EXPIRED).length;
      const pendingConsents = allConsents.filter(c => c.status === ConsentStatus.PENDING).length;

      // Consent by purpose analysis
      const consentsByPurpose = {} as Record<ProcessingPurpose, any>;
      Object.values(ProcessingPurpose).forEach(purpose => {
        const purposeConsents = allConsents.filter(c => c.purpose === purpose);
        const activePurposeConsents = purposeConsents.filter(c => c.status === ConsentStatus.GIVEN);
        const withdrawnPurposeConsents = purposeConsents.filter(c => c.status === ConsentStatus.WITHDRAWN);
        
        consentsByPurpose[purpose] = {
          total: purposeConsents.length,
          active: activePurposeConsents.length,
          withdrawalRate: purposeConsents.length > 0 ? 
            (withdrawnPurposeConsents.length / purposeConsents.length) * 100 : 0,
        };
      });

      // Consent trends (daily aggregation)
      const consentTrends = this.calculateConsentTrends(allConsents, startDate, endDate);

      // Compliance metrics
      const minorConsentsCount = allConsents.filter(c => c.isMinor).length;
      const averageResponseTime = this.calculateAverageResponseTime(allConsents);
      const timesToExpiry = allConsents
        .filter(c => c.status === ConsentStatus.GIVEN && c.expiryDate)
        .map(c => Math.ceil((c.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      
      const renewalRate = this.calculateRenewalRate(allConsents);

      // Risk indicators
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const expiringConsents = allConsents.filter(c => 
        c.status === ConsentStatus.GIVEN && 
        c.expiryDate && 
        c.expiryDate <= thirtyDaysFromNow
      ).length;

      const currentVersion = '1.0'; // This should come from configuration
      const outdatedVersions = allConsents.filter(c => c.version !== currentVersion).length;

      const invalidConsents = allConsents.filter(c => 
        !c.consentText || 
        !c.version || 
        (c.isMinor && !c.legalGuardian)
      ).length;

      const highWithdrawalPurposes = Object.entries(consentsByPurpose)
        .filter(([, data]) => data.withdrawalRate > 20) // More than 20% withdrawal rate
        .map(([purpose]) => purpose as ProcessingPurpose);

      return {
        totalConsents,
        activeConsents,
        withdrawnConsents,
        expiredConsents,
        pendingConsents,
        consentsByPurpose,
        consentTrends,
        complianceMetrics: {
          averageResponseTime,
          timesToExpiry,
          renewalRate,
          minorConsentsCount,
        },
        riskIndicators: {
          expiringConsents,
          outdatedVersions,
          invalidConsents,
          highWithdrawalPurposes,
        },
      };

    } catch (error) {
      this.logger.error(`Error generating consent analytics: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to generate consent analytics');
    }
  }

  /**
   * Automatically expire consents that have passed their expiry date
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async expireOutdatedConsents(): Promise<void> {
    try {
      this.logger.log('Starting automated consent expiry process...');

      const expiredConsents = await this.consentRepository.find({
        where: {
          status: ConsentStatus.GIVEN,
          expiryDate: Between(new Date(0), new Date()),
          isDeleted: false,
        },
      });

      for (const consent of expiredConsents) {
        await this.expireConsent(consent);
      }

      this.logger.log(`Expired ${expiredConsents.length} outdated consents`);

    } catch (error) {
      this.logger.error(`Error during automated consent expiry: ${error.message}`, error.stack);
    }
  }

  /**
   * Send consent renewal reminders
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendConsentRenewalReminders(): Promise<void> {
    try {
      this.logger.log('Checking for consents requiring renewal reminders...');

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Get consents expiring in 30 days and 7 days
      const expiringConsents = await this.consentRepository.find({
        where: [
          {
            status: ConsentStatus.GIVEN,
            expiryDate: Between(new Date(), thirtyDaysFromNow),
            isDeleted: false,
          },
          {
            status: ConsentStatus.GIVEN,
            expiryDate: Between(new Date(), sevenDaysFromNow),
            isDeleted: false,
          },
        ],
      });

      for (const consent of expiringConsents) {
        const daysToExpiry = Math.ceil(
          (consent.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if (daysToExpiry === 30 || daysToExpiry === 7) {
          this.eventEmitter.emit('privacy.consent.renewal_reminder', {
            tenantId: consent.tenantId,
            userId: consent.userId,
            purpose: consent.purpose,
            consentId: consent.id,
            daysToExpiry,
            expiryDate: consent.expiryDate,
          });
        }
      }

      this.logger.log(`Sent renewal reminders for ${expiringConsents.length} consents`);

    } catch (error) {
      this.logger.error(`Error sending consent renewal reminders: ${error.message}`, error.stack);
    }
  }

  // Private helper methods

  private async updateExistingConsent(
    existingConsent: PrivacyConsent,
    request: ConsentRequestDto,
    updatedBy: string,
  ): Promise<PrivacyConsent> {
    existingConsent.status = ConsentStatus.GIVEN;
    existingConsent.consentText = request.consentText;
    existingConsent.consentTextEn = request.consentTextEn;
    existingConsent.version = request.version;
    existingConsent.givenAt = new Date();
    existingConsent.updatedBy = updatedBy;

    if (request.expiryDays) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + request.expiryDays);
      existingConsent.expiryDate = expiryDate;
    }

    // Add to audit trail
    const auditEntry = {
      action: 'modified' as const,
      timestamp: new Date(),
      userId: updatedBy,
      ipAddress: request.ipAddress || '',
      userAgent: request.userAgent || '',
      details: {
        version: request.version,
        purpose: request.purpose,
        previousVersion: existingConsent.version,
      },
    };

    existingConsent.auditTrail = [...(existingConsent.auditTrail || []), auditEntry];

    return await this.consentRepository.save(existingConsent);
  }

  private async expireConsent(consent: PrivacyConsent): Promise<void> {
    consent.status = ConsentStatus.EXPIRED;
    
    const auditEntry = {
      action: 'expired' as const,
      timestamp: new Date(),
      userId: 'system',
      ipAddress: '',
      userAgent: 'automated_process',
      details: {
        originalExpiryDate: consent.expiryDate,
        purpose: consent.purpose,
      },
    };

    consent.auditTrail = [...(consent.auditTrail || []), auditEntry];
    
    await this.consentRepository.save(consent);

    // Emit consent expired event
    this.eventEmitter.emit('privacy.consent.expired', {
      tenantId: consent.tenantId,
      userId: consent.userId,
      purpose: consent.purpose,
      consentId: consent.id,
      expiryDate: consent.expiryDate,
      timestamp: new Date(),
    });
  }

  private calculateConsentTrends(
    consents: PrivacyConsent[],
    startDate?: Date,
    endDate?: Date,
  ): any[] {
    const trends = new Map<string, { given: number; withdrawn: number; expired: number }>();

    consents.forEach(consent => {
      const dateKey = consent.createdAt.toISOString().split('T')[0];
      const trend = trends.get(dateKey) || { given: 0, withdrawn: 0, expired: 0 };

      if (consent.givenAt) trend.given++;
      if (consent.status === ConsentStatus.WITHDRAWN) trend.withdrawn++;
      if (consent.status === ConsentStatus.EXPIRED) trend.expired++;

      trends.set(dateKey, trend);
    });

    return Array.from(trends.entries())
      .map(([dateStr, data]) => ({
        date: new Date(dateStr),
        ...data,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private calculateAverageResponseTime(consents: PrivacyConsent[]): number {
    const responseTimes = consents
      .filter(c => c.givenAt && c.createdAt)
      .map(c => c.givenAt!.getTime() - c.createdAt.getTime());

    if (responseTimes.length === 0) return 0;

    const averageMs = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return averageMs / (1000 * 60 * 60); // Convert to hours
  }

  private calculateRenewalRate(consents: PrivacyConsent[]): number {
    const renewedConsents = consents.filter(c => 
      c.auditTrail?.some(entry => entry.action === 'renewed')
    );

    const eligibleForRenewal = consents.filter(c => 
      c.status === ConsentStatus.EXPIRED || 
      (c.expiryDate && c.expiryDate < new Date())
    );

    if (eligibleForRenewal.length === 0) return 0;

    return (renewedConsents.length / eligibleForRenewal.length) * 100;
  }
}