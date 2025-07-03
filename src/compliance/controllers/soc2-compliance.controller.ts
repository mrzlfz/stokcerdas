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
import { IsEnum, IsOptional, IsString, IsDateString, IsNumber, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EnterprisePermissionsGuard } from '../../auth/guards/enterprise-permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionResource, PermissionAction } from '../../auth/entities/permission.entity';
import { SOC2ControlService } from '../services/soc2-control.service';
import { SOC2AuditLogService } from '../services/soc2-audit-log.service';
import { 
  SOC2Control, 
  TrustServiceCriteria, 
  ControlStatus, 
  RiskLevel 
} from '../entities/soc2-control.entity';
import { 
  SOC2AuditLog, 
  AuditEventType, 
  AuditEventSeverity, 
  AuditEventOutcome 
} from '../entities/soc2-audit-log.entity';

// DTOs
class GetControlsQueryDto {
  @IsOptional()
  @IsEnum(TrustServiceCriteria)
  criteria?: TrustServiceCriteria;

  @IsOptional()
  @IsEnum(ControlStatus)
  status?: ControlStatus;

  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @IsOptional()
  @IsBoolean()
  overdue?: boolean;
}

class UpdateControlStatusDto {
  @IsEnum(ControlStatus)
  status: ControlStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

class RecordTestResultDto {
  @IsString()
  controlId: string;

  @IsDateString()
  testDate: string;

  @IsEnum(['passed', 'failed', 'not_applicable', 'exception'])
  testResult: 'passed' | 'failed' | 'not_applicable' | 'exception';

  @IsOptional()
  @IsString()
  findings?: string;

  @IsOptional()
  deficiencies?: any[];

  @IsOptional()
  evidence?: string[];
}

class CollectEvidenceDto {
  @IsString()
  evidenceType: string;

  @IsString()
  evidenceName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  filePath: string;

  @IsString()
  fileHash: string;

  @IsNumber()
  fileSize: number;

  @IsString()
  mimeType: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  metadata?: any;
}

class AuditLogQueryDto {
  @IsOptional()
  @IsEnum(AuditEventType, { each: true })
  eventTypes?: AuditEventType[];

  @IsOptional()
  @IsEnum(AuditEventSeverity, { each: true })
  severity?: AuditEventSeverity[];

  @IsOptional()
  @IsEnum(AuditEventOutcome, { each: true })
  outcome?: AuditEventOutcome[];

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  searchTerm?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @IsEnum(['timestamp', 'severity', 'riskScore'])
  orderBy?: 'timestamp' | 'severity' | 'riskScore';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  orderDirection?: 'ASC' | 'DESC';
}

class SecurityAnalysisQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

@ApiTags('SOC 2 Compliance')
@ApiBearerAuth()
@Controller('compliance/soc2')
@UseGuards(JwtAuthGuard, EnterprisePermissionsGuard)
export class SOC2ComplianceController {
  constructor(
    private readonly soc2ControlService: SOC2ControlService,
    private readonly soc2AuditLogService: SOC2AuditLogService,
  ) {}

  // SOC 2 Controls Management

  @Get('controls')
  @ApiOperation({ summary: 'Get all SOC 2 controls' })
  @ApiResponse({ status: 200, description: 'Controls retrieved successfully' })
  @Permissions({ resource: PermissionResource.COMPLIANCE, action: PermissionAction.READ })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getControls(
    @Request() req: any,
    @Query() query: GetControlsQueryDto,
  ): Promise<{
    success: boolean;
    data: SOC2Control[];
    meta: {
      total: number;
      filters: any;
    };
  }> {
    const tenantId = req.user.tenantId;
    const controls = await this.soc2ControlService.getControls(tenantId, query);

    return {
      success: true,
      data: controls,
      meta: {
        total: controls.length,
        filters: query,
      },
    };
  }

  @Get('controls/:controlId')
  @ApiOperation({ summary: 'Get specific SOC 2 control' })
  @ApiResponse({ status: 200, description: 'Control retrieved successfully' })
  @Permissions({ resource: PermissionResource.COMPLIANCE, action: PermissionAction.READ })
  async getControl(
    @Request() req: any,
    @Param('controlId') controlId: string,
  ): Promise<{
    success: boolean;
    data: SOC2Control;
  }> {
    const tenantId = req.user.tenantId;
    const control = await this.soc2ControlService.getControl(tenantId, controlId);

    return {
      success: true,
      data: control,
    };
  }

  @Put('controls/:controlId/status')
  @ApiOperation({ summary: 'Update control status' })
  @ApiResponse({ status: 200, description: 'Control status updated successfully' })
  @Permissions({ resource: PermissionResource.COMPLIANCE, action: PermissionAction.UPDATE })
  async updateControlStatus(
    @Request() req: any,
    @Param('controlId') controlId: string,
    @Body() updateDto: UpdateControlStatusDto,
  ): Promise<{
    success: boolean;
    data: SOC2Control;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const control = await this.soc2ControlService.updateControlStatus(
      tenantId,
      controlId,
      updateDto.status,
      updateDto.notes,
    );

    // Log the status change
    await this.soc2AuditLogService.logPrivilegedAction(
      tenantId,
      AuditEventType.SYSTEM_CONFIG_CHANGE,
      req.user,
      `Updated SOC 2 control ${controlId} status to ${updateDto.status}`,
      AuditEventOutcome.SUCCESS,
      { controlId, previousStatus: control.status },
      { controlId, newStatus: updateDto.status, notes: updateDto.notes }
    );

    return {
      success: true,
      data: control,
      message: 'Control status updated successfully',
    };
  }

  @Post('controls/:controlId/tests')
  @ApiOperation({ summary: 'Record control test result' })
  @ApiResponse({ status: 201, description: 'Test result recorded successfully' })
  @Permissions({ resource: PermissionResource.COMPLIANCE, action: PermissionAction.CREATE })
  async recordTestResult(
    @Request() req: any,
    @Param('controlId') controlId: string,
    @Body() testDto: RecordTestResultDto,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const test = await this.soc2ControlService.recordTestResult(tenantId, {
      ...testDto,
      testDate: new Date(testDto.testDate),
      tester: req.user.id,
    });

    // Log the test result
    await this.soc2AuditLogService.logEvent(tenantId, {
      eventType: AuditEventType.CONTROL_TEST,
      eventDescription: `Recorded test result for control ${controlId}: ${testDto.testResult}`,
      severity: testDto.testResult === 'failed' ? AuditEventSeverity.HIGH : AuditEventSeverity.LOW,
      outcome: AuditEventOutcome.SUCCESS,
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      resourceType: 'soc2_control',
      resourceId: controlId,
      sourceSystem: 'API',
      sourceModule: 'Compliance',
      additionalData: {
        testResult: testDto.testResult,
        hasDeficiencies: !!(testDto.deficiencies && testDto.deficiencies.length > 0),
      },
    });

    return {
      success: true,
      data: test,
      message: 'Test result recorded successfully',
    };
  }

  @Post('controls/:controlId/evidence')
  @ApiOperation({ summary: 'Collect evidence for control' })
  @ApiResponse({ status: 201, description: 'Evidence collected successfully' })
  @Permissions({ resource: PermissionResource.COMPLIANCE, action: PermissionAction.CREATE })
  async collectEvidence(
    @Request() req: any,
    @Param('controlId') controlId: string,
    @Body() evidenceDto: CollectEvidenceDto,
  ): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    const evidence = await this.soc2ControlService.collectEvidence(tenantId, controlId, {
      ...evidenceDto,
      periodStart: new Date(evidenceDto.periodStart),
      periodEnd: new Date(evidenceDto.periodEnd),
      collectedBy: req.user.id,
    });

    // Log the evidence collection
    await this.soc2AuditLogService.logEvent(tenantId, {
      eventType: AuditEventType.EVIDENCE_COLLECTED,
      eventDescription: `Collected evidence for control ${controlId}: ${evidenceDto.evidenceName}`,
      severity: AuditEventSeverity.LOW,
      outcome: AuditEventOutcome.SUCCESS,
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      resourceType: 'soc2_control',
      resourceId: controlId,
      sourceSystem: 'API',
      sourceModule: 'Compliance',
      additionalData: {
        evidenceType: evidenceDto.evidenceType,
        evidenceName: evidenceDto.evidenceName,
        fileSize: evidenceDto.fileSize,
        mimeType: evidenceDto.mimeType,
      },
    });

    return {
      success: true,
      data: evidence,
      message: 'Evidence collected successfully',
    };
  }

  @Get('reports/compliance')
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiResponse({ status: 200, description: 'Compliance report generated successfully' })
  @Permissions({ resource: PermissionResource.COMPLIANCE, action: PermissionAction.READ })
  async generateComplianceReport(
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: any;
  }> {
    const tenantId = req.user.tenantId;
    const report = await this.soc2ControlService.generateComplianceReport(tenantId);

    // Log report generation
    await this.soc2AuditLogService.logEvent(tenantId, {
      eventType: AuditEventType.DATA_EXPORT,
      eventDescription: 'Generated SOC 2 compliance report',
      severity: AuditEventSeverity.MEDIUM,
      outcome: AuditEventOutcome.SUCCESS,
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      resourceType: 'compliance_report',
      sourceSystem: 'API',
      sourceModule: 'Compliance',
      additionalData: {
        reportType: 'soc2_compliance',
        overallStatus: report.overallStatus,
        totalControls: report.totalControls,
        riskScore: report.riskScore,
      },
    });

    return {
      success: true,
      data: report,
    };
  }

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize default SOC 2 controls' })
  @ApiResponse({ status: 201, description: 'SOC 2 controls initialized successfully' })
  @Permissions({ resource: PermissionResource.COMPLIANCE, action: PermissionAction.MANAGE_SYSTEM })
  @HttpCode(HttpStatus.CREATED)
  async initializeControls(
    @Request() req: any,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const tenantId = req.user.tenantId;
    await this.soc2ControlService.initializeDefaultControls(tenantId);

    // Log the initialization
    await this.soc2AuditLogService.logPrivilegedAction(
      tenantId,
      AuditEventType.SYSTEM_CONFIG_CHANGE,
      req.user,
      'Initialized default SOC 2 controls',
      AuditEventOutcome.SUCCESS,
      {},
      { action: 'initialize_soc2_controls' }
    );

    return {
      success: true,
      message: 'SOC 2 controls initialized successfully',
    };
  }

  // Audit Logs Management

  @Get('audit-logs')
  @ApiOperation({ summary: 'Query audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  @Permissions({ resource: PermissionResource.AUDIT_LOGS, action: PermissionAction.READ })
  @UsePipes(new ValidationPipe({ transform: true }))
  async queryAuditLogs(
    @Request() req: any,
    @Query() query: AuditLogQueryDto,
  ): Promise<{
    success: boolean;
    data: SOC2AuditLog[];
    meta: {
      total: number;
      limit: number;
      offset: number;
      filters: any;
    };
  }> {
    const tenantId = req.user.tenantId;
    
    const queryParams = {
      tenantId,
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const result = await this.soc2AuditLogService.queryLogs(queryParams);

    // Log audit log access (for compliance purposes)
    await this.soc2AuditLogService.logEvent(tenantId, {
      eventType: AuditEventType.AUDIT_LOG_ACCESS,
      eventDescription: `Accessed audit logs with filters: ${JSON.stringify(query)}`,
      severity: AuditEventSeverity.MEDIUM,
      outcome: AuditEventOutcome.SUCCESS,
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      sourceSystem: 'API',
      sourceModule: 'Compliance',
      additionalData: {
        queryFilters: query,
        resultCount: result.total,
      },
    });

    return {
      success: true,
      data: result.logs,
      meta: {
        total: result.total,
        limit: query.limit || 100,
        offset: query.offset || 0,
        filters: query,
      },
    };
  }

  @Get('security-analysis')
  @ApiOperation({ summary: 'Generate security analysis report' })
  @ApiResponse({ status: 200, description: 'Security analysis generated successfully' })
  @Permissions({ resource: PermissionResource.AUDIT_LOGS, action: PermissionAction.READ })
  async generateSecurityAnalysis(
    @Request() req: any,
    @Query() query: SecurityAnalysisQueryDto,
  ): Promise<{
    success: boolean;
    data: any;
  }> {
    const tenantId = req.user.tenantId;
    const analysis = await this.soc2AuditLogService.generateSecurityAnalysis(
      tenantId,
      new Date(query.startDate),
      new Date(query.endDate),
    );

    // Log security analysis generation
    await this.soc2AuditLogService.logEvent(tenantId, {
      eventType: AuditEventType.DATA_EXPORT,
      eventDescription: `Generated security analysis report for period ${query.startDate} to ${query.endDate}`,
      severity: AuditEventSeverity.MEDIUM,
      outcome: AuditEventOutcome.SUCCESS,
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      resourceType: 'security_analysis_report',
      sourceSystem: 'API',
      sourceModule: 'Compliance',
      additionalData: {
        reportType: 'security_analysis',
        timeRange: {
          start: query.startDate,
          end: query.endDate,
        },
        totalEvents: analysis.totalEvents,
        securityEvents: analysis.securityEvents,
      },
    });

    return {
      success: true,
      data: analysis,
    };
  }

  // Control Dashboard and Overview

  @Get('dashboard')
  @ApiOperation({ summary: 'Get SOC 2 compliance dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  @Permissions({ resource: PermissionResource.COMPLIANCE, action: PermissionAction.READ })
  async getComplianceDashboard(
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: {
      overview: any;
      recentTests: any[];
      overdueControls: any[];
      riskSummary: any;
      recentSecurityEvents: any[];
    };
  }> {
    const tenantId = req.user.tenantId;

    // Get compliance report for overview
    const complianceReport = await this.soc2ControlService.generateComplianceReport(tenantId);

    // Get overdue controls
    const overdueControls = await this.soc2ControlService.getControls(tenantId, { overdue: true });

    // Get recent security events (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const securityEventsQuery = await this.soc2AuditLogService.queryLogs({
      tenantId,
      eventTypes: [
        AuditEventType.LOGIN_FAILURE,
        AuditEventType.SUSPICIOUS_ACTIVITY,
        AuditEventType.BRUTE_FORCE_ATTEMPT,
        AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        AuditEventType.SECURITY_VIOLATION,
      ],
      startDate: sevenDaysAgo,
      endDate: new Date(),
      limit: 10,
    });

    return {
      success: true,
      data: {
        overview: {
          overallStatus: complianceReport.overallStatus,
          totalControls: complianceReport.totalControls,
          passedControls: complianceReport.passedControls,
          failedControls: complianceReport.failedControls,
          exceptionsCount: complianceReport.exceptionsCount,
          riskScore: complianceReport.riskScore,
        },
        recentTests: [], // Would be populated with recent test results
        overdueControls: overdueControls.map(control => ({
          controlId: control.controlId,
          controlName: control.controlName,
          daysSinceLastTest: control.daysSinceLastTest,
          riskScore: control.riskScore,
        })),
        riskSummary: {
          topRisks: complianceReport.topRisks,
          recommendations: complianceReport.recommendations,
        },
        recentSecurityEvents: securityEventsQuery.logs.slice(0, 5),
      },
    };
  }

  // Health Check and Status

  @Get('health')
  @ApiOperation({ summary: 'Get SOC 2 compliance health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  @Permissions({ resource: PermissionResource.COMPLIANCE, action: PermissionAction.READ })
  async getComplianceHealth(
    @Request() req: any,
  ): Promise<{
    success: boolean;
    data: {
      status: 'healthy' | 'warning' | 'critical';
      lastAssessment: Date;
      issues: string[];
      metrics: {
        controlCoverage: number;
        testingCurrency: number;
        exceptionRate: number;
        averageRiskScore: number;
      };
    };
  }> {
    const tenantId = req.user.tenantId;
    const controls = await this.soc2ControlService.getControls(tenantId);
    const complianceReport = await this.soc2ControlService.generateComplianceReport(tenantId);

    const totalControls = controls.length;
    const overdueControls = controls.filter(c => c.isOverdue).length;
    const controlsWithExceptions = controls.filter(c => c.hasActiveExceptions).length;
    const averageRiskScore = controls.reduce((sum, c) => sum + c.riskScore, 0) / totalControls;

    const controlCoverage = (complianceReport.passedControls / totalControls) * 100;
    const testingCurrency = ((totalControls - overdueControls) / totalControls) * 100;
    const exceptionRate = (controlsWithExceptions / totalControls) * 100;

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (overdueControls > 0) {
      issues.push(`${overdueControls} controls have overdue testing`);
      status = 'warning';
    }

    if (controlsWithExceptions > 0) {
      issues.push(`${controlsWithExceptions} controls have active exceptions`);
      status = 'warning';
    }

    if (averageRiskScore > 50) {
      issues.push('Average risk score is above acceptable threshold');
      status = 'warning';
    }

    if (complianceReport.overallStatus === 'non_compliant') {
      issues.push('Overall compliance status is non-compliant');
      status = 'critical';
    }

    if (controlCoverage < 80) {
      issues.push('Control coverage is below 80%');
      status = 'critical';
    }

    return {
      success: true,
      data: {
        status,
        lastAssessment: new Date(),
        issues,
        metrics: {
          controlCoverage,
          testingCurrency,
          exceptionRate,
          averageRiskScore,
        },
      },
    };
  }
}