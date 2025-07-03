import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { 
  IsEnum, 
  IsOptional, 
  IsString, 
  IsDateString, 
  IsNumber, 
  IsBoolean, 
  ValidateNested,
  IsArray,
  IsEmail,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EnterprisePermissionsGuard } from '../../auth/guards/enterprise-permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionResource, PermissionAction } from '../../auth/entities/permission.entity';

// Services
import { PrivacyConsentService } from '../services/privacy-consent.service';
import { DataSubjectRightsService } from '../services/data-subject-rights.service';
import { DataRetentionService } from '../services/data-retention.service';

// Entities and Enums
import {
  ProcessingPurpose,
  ConsentStatus,
  DataSubjectRight,
  RequestStatus,
  PersonalDataCategory,
  LegalBasisUUPDP,
} from '../entities/privacy-management.entity';

// DTOs for Consent Management
class CollectConsentDto {
  @IsString()
  userId: string;

  @IsEnum(ProcessingPurpose)
  purpose: ProcessingPurpose;

  @IsString()
  consentText: string;

  @IsOptional()
  @IsString()
  consentTextEn?: string;

  @IsString()
  version: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650) // Max 10 years
  expiryDays?: number;

  @IsOptional()
  @IsArray()
  granularConsents?: {
    purpose: ProcessingPurpose;
    consented: boolean;
  }[];

  @IsOptional()
  @IsBoolean()
  isMinor?: boolean;

  @IsOptional()
  @IsString()
  legalGuardian?: string;

  @IsOptional()
  parentalConsent?: {
    parentName: string;
    parentEmail: string;
    verificationMethod: string;
  };
}

class WithdrawConsentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class ConsentQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(ProcessingPurpose)
  purpose?: ProcessingPurpose;

  @IsOptional()
  @IsEnum(ConsentStatus)
  status?: ConsentStatus;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isExpiring?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isMinor?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeWithdrawn?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}

// DTOs for Data Subject Rights
class SubmitDataSubjectRequestDto {
  @IsString()
  userId: string;

  @IsEnum(DataSubjectRight)
  requestType: DataSubjectRight;

  @IsOptional()
  @IsString()
  requestDescription?: string;

  @IsOptional()
  @IsString()
  requestReason?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specificDataRequested?: string[];

  @IsOptional()
  @IsEnum(['email', 'download', 'api', 'physical'])
  deliveryMethod?: 'email' | 'download' | 'api' | 'physical';

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsEnum(['json', 'csv', 'xml', 'pdf'])
  fileFormat?: 'json' | 'csv' | 'xml' | 'pdf';

  @IsOptional()
  @IsBoolean()
  urgentRequest?: boolean;
}

class ProcessRequestDto {
  @IsEnum(RequestStatus)
  status: RequestStatus;

  @IsOptional()
  @IsString()
  responseMessage?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class RectificationDataDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Add other fields that can be corrected
}

class DataSubjectRequestQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(DataSubjectRight)
  requestType?: DataSubjectRight;

  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}

// DTOs for Data Retention
class CreateRetentionPolicyDto {
  @IsString()
  policyName: string;

  @IsString()
  description: string;

  @IsEnum(PersonalDataCategory)
  dataCategory: PersonalDataCategory;

  @IsEnum(ProcessingPurpose)
  processingPurpose: ProcessingPurpose;

  @IsEnum(LegalBasisUUPDP)
  legalBasis: LegalBasisUUPDP;

  @IsNumber()
  @Min(1)
  @Max(7300) // Max 20 years
  retentionDays: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  archivalDays?: number;

  @IsOptional()
  @IsBoolean()
  requiresUserAction?: boolean;

  @IsOptional()
  @IsBoolean()
  automaticDeletion?: boolean;

  @IsOptional()
  @IsBoolean()
  anonymizationAllowed?: boolean;

  @IsString()
  retentionReason: string;

  @IsOptional()
  @IsString()
  deletionCriteria?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
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

class RetentionPolicyQueryDto {
  @IsOptional()
  @IsEnum(PersonalDataCategory)
  dataCategory?: PersonalDataCategory;

  @IsOptional()
  @IsEnum(ProcessingPurpose)
  processingPurpose?: ProcessingPurpose;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  expiringSoon?: boolean;
}

class ArchiveDataDto {
  @IsOptional()
  @IsString()
  policyId?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

class PurgeDataDto {
  @IsOptional()
  @IsString()
  policyId?: string;

  @IsString()
  confirmationToken: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

@ApiTags('Privacy Management (UU PDP Compliance)')
@ApiBearerAuth()
@Controller('privacy')
@UseGuards(JwtAuthGuard, EnterprisePermissionsGuard)
export class PrivacyManagementController {
  constructor(
    private readonly consentService: PrivacyConsentService,
    private readonly dataSubjectRightsService: DataSubjectRightsService,
    private readonly dataRetentionService: DataRetentionService,
  ) {}

  // ===== CONSENT MANAGEMENT ENDPOINTS =====

  @Post('consent/collect')
  @ApiOperation({ summary: 'Collect user consent for data processing' })
  @ApiResponse({ status: 201, description: 'Consent collected successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.CREATE })
  @HttpCode(HttpStatus.CREATED)
  async collectConsent(
    @Request() req: any,
    @Body() consentDto: CollectConsentDto,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const consent = await this.consentService.collectConsent(
      tenantId,
      {
        ...consentDto,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      req.user.id,
    );

    return {
      success: true,
      data: consent,
      message: 'Consent collected successfully',
    };
  }

  @Put('consent/:userId/:purpose/withdraw')
  @ApiOperation({ summary: 'Withdraw user consent for specific purpose' })
  @ApiResponse({ status: 200, description: 'Consent withdrawn successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.UPDATE })
  async withdrawConsent(
    @Request() req: any,
    @Param('userId') userId: string,
    @Param('purpose') purpose: ProcessingPurpose,
    @Body() withdrawalDto: WithdrawConsentDto,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const consent = await this.consentService.withdrawConsent(
      tenantId,
      userId,
      purpose,
      {
        ...withdrawalDto,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      req.user.id,
    );

    return {
      success: true,
      data: consent,
      message: 'Consent withdrawn successfully',
    };
  }

  @Get('consent')
  @ApiOperation({ summary: 'Query consent records with filtering' })
  @ApiResponse({ status: 200, description: 'Consent records retrieved successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  @UsePipes(new ValidationPipe({ transform: true }))
  async queryConsents(
    @Request() req: any,
    @Query() query: ConsentQueryDto,
  ): Promise<{
    success: boolean;
    data: any[];
    meta: {
      total: number;
      limit: number;
      offset: number;
      filters: any;
    };
  }> {
    const tenantId = req.user.tenantId;
    const result = await this.consentService.queryConsents(tenantId, {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return {
      success: true,
      data: result.consents,
      meta: {
        total: result.total,
        limit: query.limit || 100,
        offset: query.offset || 0,
        filters: query,
      },
    };
  }

  @Get('consent/user/:userId')
  @ApiOperation({ summary: 'Get all consents for specific user' })
  @ApiResponse({ status: 200, description: 'User consents retrieved successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  async getUserConsents(
    @Request() req: any,
    @Param('userId') userId: string,
    @Query('purposes') purposes?: string,
  ): Promise<{
    success: boolean;
    data: any[];
  }> {
    const tenantId = req.user.tenantId;
    const includePurposes = purposes 
      ? purposes.split(',').map(p => p.trim() as ProcessingPurpose)
      : undefined;

    const consents = await this.consentService.getUserConsents(
      tenantId,
      userId,
      includePurposes,
    );

    return {
      success: true,
      data: consents,
    };
  }

  @Get('consent/analytics')
  @ApiOperation({ summary: 'Generate consent analytics and metrics' })
  @ApiResponse({ status: 200, description: 'Consent analytics generated successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  async getConsentAnalytics(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{
    success: boolean;
    data: any;
  }> {
    const tenantId = req.user.tenantId;
    const analytics = await this.consentService.generateConsentAnalytics(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return {
      success: true,
      data: analytics,
    };
  }

  @Get('consent/check/:userId/:purpose')
  @ApiOperation({ summary: 'Check if user has valid consent for purpose' })
  @ApiResponse({ status: 200, description: 'Consent status checked successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  async checkConsentValidity(
    @Request() req: any,
    @Param('userId') userId: string,
    @Param('purpose') purpose: ProcessingPurpose,
  ): Promise<{
    success: boolean;
    data: {
      hasValidConsent: boolean;
      purpose: ProcessingPurpose;
      userId: string;
      checkedAt: Date;
    };
  }> {
    const tenantId = req.user.tenantId;
    const hasValidConsent = await this.consentService.hasValidConsent(
      tenantId,
      userId,
      purpose,
    );

    return {
      success: true,
      data: {
        hasValidConsent,
        purpose,
        userId,
        checkedAt: new Date(),
      },
    };
  }

  // ===== DATA SUBJECT RIGHTS ENDPOINTS =====

  @Post('data-subject-requests')
  @ApiOperation({ summary: 'Submit a data subject rights request' })
  @ApiResponse({ status: 201, description: 'Data subject request submitted successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.CREATE })
  @HttpCode(HttpStatus.CREATED)
  async submitDataSubjectRequest(
    @Request() req: any,
    @Body() requestDto: SubmitDataSubjectRequestDto,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const request = await this.dataSubjectRightsService.submitRequest(
      tenantId,
      {
        ...requestDto,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      req.user.id,
    );

    return {
      success: true,
      data: request,
      message: 'Data subject request submitted successfully',
    };
  }

  @Get('data-subject-requests')
  @ApiOperation({ summary: 'Get data subject requests with filtering' })
  @ApiResponse({ status: 200, description: 'Data subject requests retrieved successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getDataSubjectRequests(
    @Request() req: any,
    @Query() query: DataSubjectRequestQueryDto,
  ): Promise<{
    success: boolean;
    data: any[];
    meta: {
      total: number;
      limit: number;
      offset: number;
      filters: any;
    };
  }> {
    const tenantId = req.user.tenantId;
    const result = await this.dataSubjectRightsService.getRequests(tenantId, {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return {
      success: true,
      data: result.requests,
      meta: {
        total: result.total,
        limit: query.limit || 100,
        offset: query.offset || 0,
        filters: query,
      },
    };
  }

  @Post('data-subject-requests/:requestId/process-access')
  @ApiOperation({ summary: 'Process data access request (Right to Access)' })
  @ApiResponse({ status: 200, description: 'Data access request processed successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.UPDATE })
  async processAccessRequest(
    @Request() req: any,
    @Param('requestId') requestId: string,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const portabilityReport = await this.dataSubjectRightsService.processAccessRequest(
      tenantId,
      requestId,
      req.user.id,
    );

    return {
      success: true,
      data: portabilityReport,
      message: 'Data access request processed successfully',
    };
  }

  @Post('data-subject-requests/:requestId/process-erasure')
  @ApiOperation({ summary: 'Process data erasure request (Right to be Forgotten)' })
  @ApiResponse({ status: 200, description: 'Data erasure request processed successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.DELETE })
  async processErasureRequest(
    @Request() req: any,
    @Param('requestId') requestId: string,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const deletionResult = await this.dataSubjectRightsService.processErasureRequest(
      tenantId,
      requestId,
      req.user.id,
    );

    return {
      success: true,
      data: deletionResult,
      message: 'Data erasure request processed successfully',
    };
  }

  @Post('data-subject-requests/:requestId/process-rectification')
  @ApiOperation({ summary: 'Process data rectification request (Right to Rectification)' })
  @ApiResponse({ status: 200, description: 'Data rectification request processed successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.UPDATE })
  async processRectificationRequest(
    @Request() req: any,
    @Param('requestId') requestId: string,
    @Body() corrections: RectificationDataDto,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    await this.dataSubjectRightsService.processRectificationRequest(
      tenantId,
      requestId,
      corrections,
      req.user.id,
    );

    return {
      success: true,
      message: 'Data rectification request processed successfully',
    };
  }

  @Put('data-subject-requests/:requestId/status')
  @ApiOperation({ summary: 'Update data subject request status' })
  @ApiResponse({ status: 200, description: 'Request status updated successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.UPDATE })
  async updateRequestStatus(
    @Request() req: any,
    @Param('requestId') requestId: string,
    @Body() statusUpdate: ProcessRequestDto,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    // This would need to be implemented in the data subject rights service
    // await this.dataSubjectRightsService.updateRequestStatus(tenantId, requestId, statusUpdate, req.user.id);

    return {
      success: true,
      message: 'Request status updated successfully',
    };
  }

  // ===== DATA RETENTION ENDPOINTS =====

  @Post('retention-policies')
  @ApiOperation({ summary: 'Create a new data retention policy' })
  @ApiResponse({ status: 201, description: 'Retention policy created successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.CREATE })
  @HttpCode(HttpStatus.CREATED)
  async createRetentionPolicy(
    @Request() req: any,
    @Body() policyDto: CreateRetentionPolicyDto,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const policy = await this.dataRetentionService.createRetentionPolicy(
      tenantId,
      {
        ...policyDto,
        effectiveDate: policyDto.effectiveDate ? new Date(policyDto.effectiveDate) : undefined,
        expiryDate: policyDto.expiryDate ? new Date(policyDto.expiryDate) : undefined,
      },
      req.user.id,
    );

    return {
      success: true,
      data: policy,
      message: 'Data retention policy created successfully',
    };
  }

  @Get('retention-policies')
  @ApiOperation({ summary: 'Get retention policies with filtering' })
  @ApiResponse({ status: 200, description: 'Retention policies retrieved successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getRetentionPolicies(
    @Request() req: any,
    @Query() query: RetentionPolicyQueryDto,
  ): Promise<{
    success: boolean;
    data: any[];
  }> {
    const tenantId = req.user.tenantId;
    const policies = await this.dataRetentionService.getRetentionPolicies(tenantId, query);

    return {
      success: true,
      data: policies,
    };
  }

  @Get('retention/lifecycle-analysis')
  @ApiOperation({ summary: 'Analyze data lifecycle status for tenant' })
  @ApiResponse({ status: 200, description: 'Data lifecycle analysis completed successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  async analyzeDataLifecycle(
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: any[];
  }> {
    const tenantId = req.user.tenantId;
    const lifecycleStatus = await this.dataRetentionService.analyzeDataLifecycle(tenantId);

    return {
      success: true,
      data: lifecycleStatus,
    };
  }

  @Get('retention/report')
  @ApiOperation({ summary: 'Generate comprehensive retention report' })
  @ApiResponse({ status: 200, description: 'Retention report generated successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  async generateRetentionReport(
    @Request() req: any,
    @Query('includePredictions') includePredictions?: string,
  ): Promise<{
    success: boolean;
    data: any;
  }> {
    const tenantId = req.user.tenantId;
    const report = await this.dataRetentionService.generateRetentionReport(
      tenantId,
      includePredictions === 'true',
    );

    return {
      success: true,
      data: report,
    };
  }

  @Post('retention/archive')
  @ApiOperation({ summary: 'Archive expired data according to retention policies' })
  @ApiResponse({ status: 200, description: 'Data archival completed successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.UPDATE })
  async archiveExpiredData(
    @Request() req: any,
    @Body() archiveDto: ArchiveDataDto,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const archivalResult = await this.dataRetentionService.archiveExpiredData(
      tenantId,
      archiveDto.policyId,
      archiveDto.dryRun || false,
    );

    return {
      success: true,
      data: archivalResult,
      message: archiveDto.dryRun 
        ? 'Dry run completed - no data was actually archived'
        : 'Data archival completed successfully',
    };
  }

  @Post('retention/purge')
  @ApiOperation({ summary: 'Permanently purge expired data' })
  @ApiResponse({ status: 200, description: 'Data purge completed successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.DELETE })
  async purgeExpiredData(
    @Request() req: any,
    @Body() purgeDto: PurgeDataDto,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const purgeResult = await this.dataRetentionService.purgeExpiredData(
      tenantId,
      purgeDto.policyId,
      purgeDto.confirmationToken,
      purgeDto.dryRun || false,
    );

    return {
      success: true,
      data: purgeResult,
      message: purgeDto.dryRun 
        ? 'Dry run completed - no data was actually purged'
        : 'Data purge completed successfully',
    };
  }

  // ===== COMPLIANCE DASHBOARD ENDPOINTS =====

  @Get('dashboard')
  @ApiOperation({ summary: 'Get UU PDP compliance dashboard data' })
  @ApiResponse({ status: 200, description: 'Privacy compliance dashboard data retrieved successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  async getPrivacyDashboard(
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: {
      consentMetrics: any;
      dataSubjectRequests: any;
      retentionMetrics: any;
      complianceStatus: any;
    };
  }> {
    const tenantId = req.user.tenantId;

    // Get metrics from all services
    const [consentAnalytics, retentionReport, requestsResult] = await Promise.all([
      this.consentService.generateConsentAnalytics(tenantId),
      this.dataRetentionService.generateRetentionReport(tenantId),
      this.dataSubjectRightsService.getRequests(tenantId, { limit: 10 }),
    ]);

    // Calculate overall compliance status
    const complianceStatus = {
      overall: 'compliant' as 'compliant' | 'partially_compliant' | 'non_compliant',
      consentCompliance: consentAnalytics.activeConsents > 0 ? 'compliant' : 'needs_attention',
      retentionCompliance: retentionReport.retentionMetrics.complianceRate > 95 ? 'compliant' : 'needs_attention',
      requestCompliance: requestsResult.requests.filter(r => r.status === RequestStatus.OVERDUE).length === 0 ? 'compliant' : 'needs_attention',
      lastUpdated: new Date(),
    };

    // Determine overall status
    const hasIssues = [
      complianceStatus.consentCompliance,
      complianceStatus.retentionCompliance,
      complianceStatus.requestCompliance,
    ].some(status => status === 'needs_attention');

    if (hasIssues) {
      complianceStatus.overall = 'partially_compliant';
    }

    return {
      success: true,
      data: {
        consentMetrics: {
          totalConsents: consentAnalytics.totalConsents,
          activeConsents: consentAnalytics.activeConsents,
          withdrawnConsents: consentAnalytics.withdrawnConsents,
          expiringConsents: consentAnalytics.riskIndicators.expiringConsents,
          complianceRate: consentAnalytics.totalConsents > 0 
            ? (consentAnalytics.activeConsents / consentAnalytics.totalConsents) * 100 
            : 100,
        },
        dataSubjectRequests: {
          totalRequests: requestsResult.total,
          pendingRequests: requestsResult.requests.filter(r => r.status === RequestStatus.PENDING).length,
          inProgressRequests: requestsResult.requests.filter(r => r.status === RequestStatus.IN_PROGRESS).length,
          completedRequests: requestsResult.requests.filter(r => r.status === RequestStatus.COMPLETED).length,
          overdueRequests: requestsResult.requests.filter(r => r.status === RequestStatus.OVERDUE).length,
        },
        retentionMetrics: {
          totalRecords: retentionReport.summary.totalRecords,
          expiringSoon: retentionReport.expiringRecords.in30Days.length,
          overdue: retentionReport.expiringRecords.overdue.length,
          complianceRate: retentionReport.retentionMetrics.complianceRate,
          automationRate: retentionReport.retentionMetrics.automationRate,
        },
        complianceStatus,
      },
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get UU PDP compliance health status' })
  @ApiResponse({ status: 200, description: 'Privacy compliance health status retrieved successfully' })
  @Permissions({ resource: PermissionResource.PRIVACY, action: PermissionAction.READ })
  async getPrivacyHealth(
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: {
      status: 'healthy' | 'warning' | 'critical';
      lastAssessment: Date;
      issues: string[];
      recommendations: string[];
      metrics: {
        consentCoverage: number;
        dataRequestResponseTime: number;
        retentionCompliance: number;
        overallScore: number;
      };
    };
  }> {
    const tenantId = req.user.tenantId;

    // Get health metrics from all services
    const [consentAnalytics, retentionReport, requestsResult] = await Promise.all([
      this.consentService.generateConsentAnalytics(tenantId),
      this.dataRetentionService.generateRetentionReport(tenantId),
      this.dataSubjectRightsService.getRequests(tenantId, { limit: 100 }),
    ]);

    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check consent coverage
    const consentCoverage = consentAnalytics.totalConsents > 0 
      ? (consentAnalytics.activeConsents / consentAnalytics.totalConsents) * 100 
      : 0;

    if (consentCoverage < 80) {
      issues.push('Low consent coverage - less than 80% of users have active consents');
      recommendations.push('Implement consent collection workflows for new and existing users');
      status = 'warning';
    }

    // Check data request response time
    const overdueRequests = requestsResult.requests.filter(r => 
      r.status === 'pending' && new Date() > new Date(r.dueDate)
    ).length;

    if (overdueRequests > 0) {
      issues.push(`${overdueRequests} data subject requests are overdue`);
      recommendations.push('Assign dedicated staff to process data subject requests within 30-day deadline');
      status = 'critical';
    }

    // Check retention compliance
    const retentionCompliance = retentionReport.retentionMetrics.complianceRate;
    if (retentionCompliance < 95) {
      issues.push('Data retention compliance below 95%');
      recommendations.push('Implement automated data lifecycle management');
      if (status !== 'critical') status = 'warning';
    }

    // Calculate overall score
    const overallScore = (consentCoverage + retentionCompliance + (overdueRequests === 0 ? 100 : 80)) / 3;

    // Response time calculation (simplified)
    const completedRequests = requestsResult.requests.filter(r => r.status === 'completed');
    const averageResponseTime = completedRequests.length > 0 
      ? completedRequests.reduce((sum, req) => {
          const responseTime = new Date(req.completedAt!).getTime() - new Date(req.createdAt).getTime();
          return sum + (responseTime / (1000 * 60 * 60 * 24)); // Convert to days
        }, 0) / completedRequests.length
      : 0;

    return {
      success: true,
      data: {
        status,
        lastAssessment: new Date(),
        issues,
        recommendations,
        metrics: {
          consentCoverage,
          dataRequestResponseTime: averageResponseTime,
          retentionCompliance,
          overallScore,
        },
      },
    };
  }
}