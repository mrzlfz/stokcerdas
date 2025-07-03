import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, In, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  DataSubjectRequest,
  DataSubjectRight,
  RequestStatus,
  DataClassification,
  PersonalDataCategory,
} from '../entities/privacy-management.entity';
import { User } from '../../users/entities/user.entity';
import { SOC2AuditLogService } from './soc2-audit-log.service';
import { AuditEventType, AuditEventOutcome, AuditEventSeverity } from '../entities/soc2-audit-log.entity';

export interface DataSubjectRequestDto {
  userId: string;
  requestType: DataSubjectRight;
  requestDescription?: string;
  requestReason?: string;
  specificDataRequested?: string[];
  deliveryMethod?: 'email' | 'download' | 'api' | 'physical';
  deliveryAddress?: string;
  fileFormat?: 'json' | 'csv' | 'xml' | 'pdf';
  urgentRequest?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface RequestProcessingDto {
  requestId: string;
  status: RequestStatus;
  responseMessage?: string;
  rejectionReason?: string;
  processedBy: string;
  notes?: string;
}

export interface DataExportResult {
  exportId: string;
  fileName: string;
  filePath: string;
  downloadLink?: string;
  fileSize: number;
  expiryDate: Date;
  recordCount: number;
  tablesExported: string[];
}

export interface DataDeletionResult {
  deletionId: string;
  deletionDate: Date;
  tablesAffected: string[];
  recordsDeleted: number;
  recordsAnonymized: number;
  recordsRetained: string[];
  retentionReasons: Record<string, string>;
}

export interface DataPortabilityReport {
  userData: {
    personalInformation: any;
    accountData: any;
    activityHistory: any;
    preferences: any;
    consents: any[];
  };
  metadata: {
    exportDate: Date;
    dataController: string;
    userId: string;
    requestId: string;
    legalBasis: string;
    retentionPolicies: any[];
  };
  statistics: {
    totalRecords: number;
    dataCategories: PersonalDataCategory[];
    oldestRecord: Date;
    newestRecord: Date;
  };
}

@Injectable()
export class DataSubjectRightsService {
  private readonly logger = new Logger(DataSubjectRightsService.name);
  private readonly exportDirectory = process.env.DATA_EXPORT_DIR || './exports';

  constructor(
    @InjectRepository(DataSubjectRequest)
    private readonly requestRepository: Repository<DataSubjectRequest>,
    @InjectRepository(DataClassification)
    private readonly dataClassificationRepository: Repository<DataClassification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogService: SOC2AuditLogService,
  ) {}

  /**
   * Submit a data subject rights request
   */
  async submitRequest(
    tenantId: string,
    request: DataSubjectRequestDto,
    submittedBy: string,
  ): Promise<DataSubjectRequest> {
    try {
      // Generate unique request ID
      const requestId = this.generateRequestId();

      // Calculate due date (30 days as per UU PDP)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // Determine priority based on request type and urgency
      const priority = this.determinePriority(request.requestType, request.urgentRequest);

      const dataSubjectRequest = this.requestRepository.create({
        tenantId,
        userId: request.userId,
        requestId,
        requestType: request.requestType,
        status: RequestStatus.PENDING,
        requestDescription: request.requestDescription,
        requestReason: request.requestReason,
        dueDate,
        requestDetails: {
          specificDataRequested: request.specificDataRequested || [],
          deliveryMethod: request.deliveryMethod || 'email',
          deliveryAddress: request.deliveryAddress,
          fileFormat: request.fileFormat || 'json',
          encryptionRequired: true,
          urgentRequest: request.urgentRequest || false,
          verificationDocuments: [],
          identityVerified: false,
          verificationMethod: 'email',
        },
        processingLog: [{
          step: 'request_submitted',
          timestamp: new Date(),
          processedBy: submittedBy,
          status: 'pending_review',
          notes: 'Initial request submission',
        }],
        requestorIp: request.ipAddress,
        requestorUserAgent: request.userAgent,
        priority,
        referenceNumber: this.generateReferenceNumber(requestId),
        createdBy: submittedBy,
      });

      const savedRequest = await this.requestRepository.save(dataSubjectRequest);

      // Emit request submitted event
      this.eventEmitter.emit('privacy.data_subject_request.submitted', {
        tenantId,
        userId: request.userId,
        requestId: savedRequest.requestId,
        requestType: request.requestType,
        priority,
        dueDate,
        submittedBy,
        timestamp: new Date(),
      });

      // Log to audit trail
      await this.auditLogService.logEvent(tenantId, {
        eventType: AuditEventType.DATA_CREATE,
        eventDescription: `Data subject rights request submitted: ${request.requestType}`,
        severity: this.getAuditSeverity(request.requestType),
        outcome: AuditEventOutcome.SUCCESS,
        userId: request.userId,
        resourceType: 'data_subject_request',
        resourceId: savedRequest.id,
        sourceSystem: 'Privacy Management',
        sourceModule: 'Data Subject Rights',
        additionalData: {
          requestType: request.requestType,
          requestId: savedRequest.requestId,
          priority,
          urgentRequest: request.urgentRequest,
        },
      });

      this.logger.log(`Data subject request submitted: ${savedRequest.requestId} for user ${request.userId}`);
      return savedRequest;

    } catch (error) {
      this.logger.error(`Error submitting data subject request: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to submit data subject request');
    }
  }

  /**
   * Process data access request (Right to Access)
   */
  async processAccessRequest(
    tenantId: string,
    requestId: string,
    processedBy: string,
  ): Promise<DataPortabilityReport> {
    try {
      const request = await this.getRequestById(tenantId, requestId);
      
      if (request.requestType !== DataSubjectRight.ACCESS) {
        throw new BadRequestException('Invalid request type for access processing');
      }

      // Update request status
      await this.updateRequestStatus(tenantId, requestId, {
        requestId,
        status: RequestStatus.IN_PROGRESS,
        processedBy,
        notes: 'Starting data access processing',
      });

      // Get user data from all relevant tables
      const userData = await this.collectUserData(tenantId, request.userId);

      // Generate portability report
      const portabilityReport: DataPortabilityReport = {
        userData,
        metadata: {
          exportDate: new Date(),
          dataController: 'StokCerdas Platform',
          userId: request.userId,
          requestId,
          legalBasis: 'UU PDP Article 27 - Right to Access',
          retentionPolicies: await this.getApplicableRetentionPolicies(tenantId),
        },
        statistics: {
          totalRecords: this.countTotalRecords(userData),
          dataCategories: await this.getDataCategories(tenantId, request.userId),
          oldestRecord: await this.getOldestRecord(tenantId, request.userId),
          newestRecord: new Date(),
        },
      };

      // Create export file
      const exportResult = await this.createExportFile(
        tenantId,
        requestId,
        portabilityReport,
        request.requestDetails?.fileFormat || 'json',
      );

      // Update request with completion details
      await this.completeRequest(tenantId, requestId, {
        exportResult,
        processedBy,
        responseMessage: 'Your personal data has been compiled and is ready for download.',
      });

      // Log completion
      await this.auditLogService.logEvent(tenantId, {
        eventType: AuditEventType.DATA_EXPORT,
        eventDescription: `Data access request completed for user ${request.userId}`,
        severity: AuditEventSeverity.MEDIUM,
        outcome: AuditEventOutcome.SUCCESS,
        userId: request.userId,
        resourceType: 'data_subject_request',
        resourceId: request.id,
        sourceSystem: 'Privacy Management',
        sourceModule: 'Data Subject Rights',
        additionalData: {
          requestId,
          recordCount: portabilityReport.statistics.totalRecords,
          fileSize: exportResult.fileSize,
          dataCategories: portabilityReport.statistics.dataCategories,
        },
      });

      return portabilityReport;

    } catch (error) {
      await this.handleRequestError(tenantId, requestId, error, processedBy);
      throw error;
    }
  }

  /**
   * Process data erasure request (Right to be Forgotten)
   */
  async processErasureRequest(
    tenantId: string,
    requestId: string,
    processedBy: string,
  ): Promise<DataDeletionResult> {
    try {
      const request = await this.getRequestById(tenantId, requestId);
      
      if (request.requestType !== DataSubjectRight.ERASURE) {
        throw new BadRequestException('Invalid request type for erasure processing');
      }

      // Update request status
      await this.updateRequestStatus(tenantId, requestId, {
        requestId,
        status: RequestStatus.IN_PROGRESS,
        processedBy,
        notes: 'Starting data erasure processing',
      });

      // Check legal obligations for data retention
      const retentionRequirements = await this.checkRetentionRequirements(tenantId, request.userId);

      // Perform data deletion/anonymization
      const deletionResult = await this.performDataDeletion(
        tenantId,
        request.userId,
        retentionRequirements,
      );

      // Update request with completion details
      await this.completeRequest(tenantId, requestId, {
        deletionResult,
        processedBy,
        responseMessage: `Your data has been deleted. ${deletionResult.recordsDeleted} records deleted, ${deletionResult.recordsAnonymized} records anonymized.`,
      });

      // Log completion
      await this.auditLogService.logEvent(tenantId, {
        eventType: AuditEventType.DATA_DELETE,
        eventDescription: `Data erasure request completed for user ${request.userId}`,
        severity: AuditEventSeverity.HIGH,
        outcome: AuditEventOutcome.SUCCESS,
        userId: request.userId,
        resourceType: 'data_subject_request',
        resourceId: request.id,
        sourceSystem: 'Privacy Management',
        sourceModule: 'Data Subject Rights',
        additionalData: {
          requestId,
          recordsDeleted: deletionResult.recordsDeleted,
          recordsAnonymized: deletionResult.recordsAnonymized,
          tablesAffected: deletionResult.tablesAffected,
          retentionReasons: deletionResult.retentionReasons,
        },
      });

      return deletionResult;

    } catch (error) {
      await this.handleRequestError(tenantId, requestId, error, processedBy);
      throw error;
    }
  }

  /**
   * Process data rectification request (Right to Rectification)
   */
  async processRectificationRequest(
    tenantId: string,
    requestId: string,
    corrections: Record<string, any>,
    processedBy: string,
  ): Promise<void> {
    try {
      const request = await this.getRequestById(tenantId, requestId);
      
      if (request.requestType !== DataSubjectRight.RECTIFICATION) {
        throw new BadRequestException('Invalid request type for rectification processing');
      }

      // Update request status
      await this.updateRequestStatus(tenantId, requestId, {
        requestId,
        status: RequestStatus.IN_PROGRESS,
        processedBy,
        notes: 'Starting data rectification processing',
      });

      // Get current user data
      const user = await this.userRepository.findOne({
        where: { id: request.userId, tenantId, isDeleted: false },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Store old values for audit
      const oldValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};

      // Apply corrections
      for (const [field, newValue] of Object.entries(corrections)) {
        if (user.hasOwnProperty(field)) {
          oldValues[field] = (user as any)[field];
          (user as any)[field] = newValue;
          newValues[field] = newValue;
        }
      }

      user.updatedBy = processedBy;
      await this.userRepository.save(user);

      // Update request with completion details
      await this.completeRequest(tenantId, requestId, {
        updateResult: { oldValues, newValues },
        processedBy,
        responseMessage: 'Your personal data has been corrected as requested.',
      });

      // Log completion
      await this.auditLogService.logEvent(tenantId, {
        eventType: AuditEventType.DATA_UPDATE,
        eventDescription: `Data rectification request completed for user ${request.userId}`,
        severity: AuditEventSeverity.MEDIUM,
        outcome: AuditEventOutcome.SUCCESS,
        userId: request.userId,
        resourceType: 'data_subject_request',
        resourceId: request.id,
        sourceSystem: 'Privacy Management',
        sourceModule: 'Data Subject Rights',
        previousValues: oldValues,
        newValues: newValues,
        additionalData: {
          requestId,
          fieldsUpdated: Object.keys(corrections),
        },
      });

    } catch (error) {
      await this.handleRequestError(tenantId, requestId, error, processedBy);
      throw error;
    }
  }

  /**
   * Get all requests for a tenant with filtering
   */
  async getRequests(
    tenantId: string,
    filters?: {
      userId?: string;
      requestType?: DataSubjectRight;
      status?: RequestStatus;
      priority?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    requests: DataSubjectRequest[];
    total: number;
  }> {
    try {
      const where: FindOptionsWhere<DataSubjectRequest> = {
        tenantId,
        isDeleted: false,
      };

      if (filters?.userId) {
        where.userId = filters.userId;
      }

      if (filters?.requestType) {
        where.requestType = filters.requestType;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.priority) {
        where.priority = filters.priority;
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = Between(
          filters.startDate || new Date(0),
          filters.endDate || new Date(),
        );
      }

      const [requests, total] = await this.requestRepository.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        take: filters?.limit || 100,
        skip: filters?.offset || 0,
      });

      return { requests, total };

    } catch (error) {
      this.logger.error(`Error getting requests: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to retrieve requests');
    }
  }

  /**
   * Check for overdue requests and send alerts
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkOverdueRequests(): Promise<void> {
    try {
      this.logger.log('Checking for overdue data subject requests...');

      const overdueRequests = await this.requestRepository.find({
        where: {
          status: In([RequestStatus.PENDING, RequestStatus.IN_PROGRESS]),
          dueDate: Between(new Date(0), new Date()),
          isDeleted: false,
        },
      });

      for (const request of overdueRequests) {
        const daysOverdue = Math.ceil(
          (Date.now() - request.dueDate!.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Emit overdue alert
        this.eventEmitter.emit('privacy.data_subject_request.overdue', {
          tenantId: request.tenantId,
          requestId: request.requestId,
          userId: request.userId,
          requestType: request.requestType,
          daysOverdue,
          dueDate: request.dueDate,
          assignedTo: request.assignedTo,
        });

        // Log overdue event
        await this.auditLogService.logEvent(request.tenantId, {
          eventType: AuditEventType.SECURITY_VIOLATION,
          eventDescription: `Data subject request ${request.requestId} is overdue by ${daysOverdue} days`,
          severity: daysOverdue > 7 ? AuditEventSeverity.HIGH : AuditEventSeverity.MEDIUM,
          outcome: AuditEventOutcome.WARNING,
          userId: request.userId,
          resourceType: 'data_subject_request',
          resourceId: request.id,
          sourceSystem: 'Privacy Management',
          sourceModule: 'Compliance Monitoring',
          additionalData: {
            requestId: request.requestId,
            requestType: request.requestType,
            daysOverdue,
            assignedTo: request.assignedTo,
          },
        });
      }

      this.logger.log(`Found ${overdueRequests.length} overdue requests`);

    } catch (error) {
      this.logger.error(`Error checking overdue requests: ${error.message}`, error.stack);
    }
  }

  // Private helper methods

  private async getRequestById(tenantId: string, requestId: string): Promise<DataSubjectRequest> {
    const request = await this.requestRepository.findOne({
      where: { tenantId, requestId, isDeleted: false },
    });

    if (!request) {
      throw new NotFoundException('Data subject request not found');
    }

    return request;
  }

  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `DSR-${timestamp}-${random}`.toUpperCase();
  }

  private generateReferenceNumber(requestId: string): string {
    return `REF-${requestId}`;
  }

  private determinePriority(requestType: DataSubjectRight, urgent?: boolean): string {
    if (urgent) return 'urgent';
    
    switch (requestType) {
      case DataSubjectRight.ERASURE:
        return 'high';
      case DataSubjectRight.ACCESS:
      case DataSubjectRight.DATA_PORTABILITY:
        return 'medium';
      default:
        return 'low';
    }
  }

  private getAuditSeverity(requestType: DataSubjectRight): AuditEventSeverity {
    switch (requestType) {
      case DataSubjectRight.ERASURE:
        return AuditEventSeverity.HIGH;
      case DataSubjectRight.ACCESS:
      case DataSubjectRight.DATA_PORTABILITY:
        return AuditEventSeverity.MEDIUM;
      default:
        return AuditEventSeverity.LOW;
    }
  }

  private async collectUserData(tenantId: string, userId: string): Promise<any> {
    // This would collect data from all tables where user data exists
    // Implementation would depend on the specific database schema
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      const userData = {
        personalInformation: {},
        accountData: {},
        activityHistory: {},
        preferences: {},
        consents: [],
      };

      // Collect user profile data
      const user = await queryRunner.query(
        'SELECT * FROM users WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
        [userId, tenantId]
      );
      userData.personalInformation = user[0] || {};

      // Collect other data based on data classification
      const dataClassifications = await this.dataClassificationRepository.find({
        where: { tenantId, isActive: true, isDeleted: false },
      });

      for (const classification of dataClassifications) {
        // Query each table/entity that contains personal data
        // This is a simplified example - real implementation would be more comprehensive
      }

      return userData;

    } finally {
      await queryRunner.release();
    }
  }

  private async updateRequestStatus(
    tenantId: string,
    requestId: string,
    update: RequestProcessingDto,
  ): Promise<void> {
    const request = await this.getRequestById(tenantId, requestId);
    
    request.status = update.status;
    request.responseMessage = update.responseMessage;
    request.rejectionReason = update.rejectionReason;
    request.updatedBy = update.processedBy;

    if (update.status === RequestStatus.COMPLETED) {
      request.completedAt = new Date();
    }

    // Add processing log entry
    const logEntry = {
      step: update.status,
      timestamp: new Date(),
      processedBy: update.processedBy,
      status: update.status,
      notes: update.notes || '',
    };

    request.processingLog = [...(request.processingLog || []), logEntry];

    await this.requestRepository.save(request);
  }

  private async createExportFile(
    tenantId: string,
    requestId: string,
    data: DataPortabilityReport,
    format: string,
  ): Promise<DataExportResult> {
    const exportId = crypto.randomUUID();
    const fileName = `data-export-${requestId}-${exportId}.${format}`;
    const filePath = path.join(this.exportDirectory, fileName);

    // Ensure export directory exists
    await fs.mkdir(this.exportDirectory, { recursive: true });

    // Write data to file based on format
    let fileContent: string;
    switch (format) {
      case 'json':
        fileContent = JSON.stringify(data, null, 2);
        break;
      case 'csv':
        fileContent = this.convertToCSV(data);
        break;
      case 'xml':
        fileContent = this.convertToXML(data);
        break;
      default:
        fileContent = JSON.stringify(data, null, 2);
    }

    await fs.writeFile(filePath, fileContent, 'utf8');

    const stats = await fs.stat(filePath);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry

    return {
      exportId,
      fileName,
      filePath,
      fileSize: stats.size,
      expiryDate,
      recordCount: data.statistics.totalRecords,
      tablesExported: [], // Would be populated based on actual tables
    };
  }

  private async performDataDeletion(
    tenantId: string,
    userId: string,
    retentionRequirements: any,
  ): Promise<DataDeletionResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      const deletionId = crypto.randomUUID();
      const deletionDate = new Date();
      const tablesAffected: string[] = [];
      let recordsDeleted = 0;
      let recordsAnonymized = 0;
      const recordsRetained: string[] = [];
      const retentionReasons: Record<string, string> = {};

      // Get data classifications to determine what can be deleted
      const dataClassifications = await this.dataClassificationRepository.find({
        where: { tenantId, isActive: true, isDeleted: false },
      });

      for (const classification of dataClassifications) {
        const tableName = classification.entityName;
        
        if (retentionRequirements[tableName]) {
          // Data must be retained for legal reasons
          recordsRetained.push(tableName);
          retentionReasons[tableName] = retentionRequirements[tableName].reason;
          
          if (classification.processingDetails?.anonymizationPossible) {
            // Anonymize instead of delete
            await this.anonymizeUserData(queryRunner, tableName, userId, tenantId);
            recordsAnonymized++;
          }
        } else {
          // Safe to delete
          const result = await queryRunner.query(
            `UPDATE ${tableName} SET is_deleted = true, deleted_at = $1, deleted_by = $2 
             WHERE user_id = $3 AND tenant_id = $4 AND is_deleted = false`,
            [deletionDate, 'system_erasure', userId, tenantId]
          );
          
          if (result.affectedRows > 0) {
            tablesAffected.push(tableName);
            recordsDeleted += result.affectedRows;
          }
        }
      }

      await queryRunner.commitTransaction();

      return {
        deletionId,
        deletionDate,
        tablesAffected,
        recordsDeleted,
        recordsAnonymized,
        recordsRetained,
        retentionReasons,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async anonymizeUserData(
    queryRunner: any,
    tableName: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    // Anonymize sensitive fields while preserving data structure
    const anonymizedData = {
      email: `anonymized_${crypto.randomUUID()}@example.com`,
      name: 'Anonymized User',
      phone: 'ANONYMIZED',
      // Add other fields as needed
    };

    const setClause = Object.keys(anonymizedData)
      .map((key, index) => `${key} = $${index + 4}`)
      .join(', ');

    const values = [
      new Date(), // updated_at
      'system_anonymization', // updated_by
      userId,
      tenantId,
      ...Object.values(anonymizedData),
    ];

    await queryRunner.query(
      `UPDATE ${tableName} SET ${setClause}, updated_at = $1, updated_by = $2 
       WHERE user_id = $3 AND tenant_id = $4 AND is_deleted = false`,
      values
    );
  }

  private async completeRequest(
    tenantId: string,
    requestId: string,
    completion: {
      exportResult?: DataExportResult;
      deletionResult?: DataDeletionResult;
      updateResult?: any;
      processedBy: string;
      responseMessage: string;
    },
  ): Promise<void> {
    const request = await this.getRequestById(tenantId, requestId);
    
    request.status = RequestStatus.COMPLETED;
    request.completedAt = new Date();
    request.responseMessage = completion.responseMessage;
    request.updatedBy = completion.processedBy;

    // Update fulfillment details
    request.fulfillmentDetails = {
      ...request.fulfillmentDetails,
      ...completion,
    };

    // Add completion log entry
    const logEntry = {
      step: 'completed',
      timestamp: new Date(),
      processedBy: completion.processedBy,
      status: 'completed',
      notes: 'Request processing completed successfully',
    };

    request.processingLog = [...(request.processingLog || []), logEntry];

    await this.requestRepository.save(request);

    // Emit completion event
    this.eventEmitter.emit('privacy.data_subject_request.completed', {
      tenantId,
      requestId,
      userId: request.userId,
      requestType: request.requestType,
      completedAt: request.completedAt,
      processedBy: completion.processedBy,
    });
  }

  private async handleRequestError(
    tenantId: string,
    requestId: string,
    error: any,
    processedBy: string,
  ): Promise<void> {
    try {
      await this.updateRequestStatus(tenantId, requestId, {
        requestId,
        status: RequestStatus.REJECTED,
        processedBy,
        rejectionReason: error.message,
        notes: `Processing failed: ${error.message}`,
      });
    } catch (updateError) {
      this.logger.error(`Failed to update request status after error: ${updateError.message}`);
    }
  }

  // Helper methods for data format conversion
  private convertToCSV(data: any): string {
    // Simple CSV conversion - would need more sophisticated implementation
    return JSON.stringify(data);
  }

  private convertToXML(data: any): string {
    // Simple XML conversion - would need more sophisticated implementation
    return `<?xml version="1.0" encoding="UTF-8"?><data>${JSON.stringify(data)}</data>`;
  }

  private countTotalRecords(userData: any): number {
    // Count all records in the user data
    let count = 0;
    
    function countRecords(obj: any): void {
      if (Array.isArray(obj)) {
        count += obj.length;
        obj.forEach(countRecords);
      } else if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(countRecords);
      }
    }
    
    countRecords(userData);
    return count;
  }

  private async getDataCategories(tenantId: string, userId: string): Promise<PersonalDataCategory[]> {
    const classifications = await this.dataClassificationRepository.find({
      where: { tenantId, isActive: true, isDeleted: false },
    });
    
    return [...new Set(classifications.map(c => c.category))];
  }

  private async getOldestRecord(tenantId: string, userId: string): Promise<Date> {
    // Query to find the oldest record for the user
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      const result = await queryRunner.query(
        'SELECT MIN(created_at) as oldest FROM users WHERE id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );
      
      return result[0]?.oldest || new Date();
    } finally {
      await queryRunner.release();
    }
  }

  private async getApplicableRetentionPolicies(tenantId: string): Promise<any[]> {
    // Get retention policies that apply to this tenant
    return []; // Implementation would depend on retention policy structure
  }

  private async checkRetentionRequirements(tenantId: string, userId: string): Promise<any> {
    // Check legal and business requirements for data retention
    return {}; // Implementation would check various retention rules
  }
}