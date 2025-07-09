import { IsString, IsOptional, IsObject, IsArray, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SecurityOrchestrationScopeType {
  IAM_SECURITY = 'iam_security',
  THREAT_DETECTION = 'threat_detection',
  ACCESS_CONTROL = 'access_control',
  COMPLIANCE_SECURITY = 'compliance_security',
  INDONESIAN_COMPREHENSIVE_SECURITY = 'indonesian_comprehensive_security',
}

export enum SecurityServiceType {
  IDENTITY_MANAGEMENT = 'identity_management',
  ACCESS_CONTROL = 'access_control',
  THREAT_DETECTION = 'threat_detection',
  SECURITY_MONITORING = 'security_monitoring',
  COMPLIANCE_MANAGEMENT = 'compliance_management',
}

export class CreateSecurityOrchestrationDto {
  @ApiProperty({
    description: 'Security scope configuration',
    example: {
      scopeId: 'security_scope_001',
      securityType: 'indonesian_comprehensive_security',
    },
  })
  @IsObject()
  securityScope: {
    scopeId: string;
    securityType: SecurityOrchestrationScopeType;
    securityServices?: any[];
    securityObjectives?: any[];
    securityCriteria?: any[];
    securityBaselines?: any[];
    securityComplexity?: any;
    indonesianSecurityPriorities?: any[];
  };

  @ApiProperty({
    description: 'IAM configuration settings',
    example: {
      identityProviders: [],
      authenticationMethods: [],
      userManagement: {},
      roleManagement: {},
      sessionManagement: {},
      indonesianIAMOptimization: {},
    },
  })
  @IsObject()
  iamConfiguration: {
    identityProviders: any[];
    authenticationMethods: any[];
    userManagement: any;
    roleManagement: any;
    sessionManagement: any;
    indonesianIAMOptimization: any;
  };

  @ApiProperty({
    description: 'Security policies configuration',
    example: {
      accessPolicies: [],
      passwordPolicies: [],
      sessionPolicies: [],
      dataPolicies: [],
      compliancePolicies: [],
      indonesianSecurityPolicies: [],
    },
  })
  @IsObject()
  securityPolicies: {
    accessPolicies: any[];
    passwordPolicies: any[];
    sessionPolicies: any[];
    dataPolicies: any[];
    compliancePolicies: any[];
    indonesianSecurityPolicies: any[];
  };

  @ApiProperty({
    description: 'Threat detection configuration',
    example: {
      detectionEngines: [],
      threatIntelligence: {},
      anomalyDetection: {},
      incidentClassification: {},
      responseAutomation: {},
    },
  })
  @IsObject()
  threatDetection: {
    detectionEngines: any[];
    threatIntelligence: any;
    anomalyDetection: any;
    incidentClassification: any;
    responseAutomation: any;
  };

  @ApiProperty({
    description: 'Indonesian security configuration',
    example: {
      regulatoryCompliance: {},
      dataResidencyRequirements: {},
      businessHoursAdaptation: {},
      culturalEventHandling: {},
      localSecurityStandards: {},
    },
  })
  @IsObject()
  indonesianSecurityConfiguration: {
    regulatoryCompliance: any;
    dataResidencyRequirements: any;
    businessHoursAdaptation: any;
    culturalEventHandling: any;
    localSecurityStandards: any;
  };

  @ApiProperty({
    description: 'Multi-factor authentication configuration',
    example: {
      mfaMethods: [],
      mfaPolicies: [],
      backupAuthentication: {},
      deviceManagement: {},
      biometricAuthentication: {},
      indonesianMFAOptimization: {},
    },
  })
  @IsObject()
  multiFactorAuthentication: {
    mfaMethods: any[];
    mfaPolicies: any[];
    backupAuthentication: any;
    deviceManagement: any;
    biometricAuthentication: any;
    indonesianMFAOptimization: any;
  };

  @ApiProperty({
    description: 'Access control management configuration',
    example: {
      rbacConfiguration: {},
      abacConfiguration: {},
      privilegedAccess: {},
      accessReviews: {},
      accessProvisioning: {},
    },
  })
  @IsObject()
  accessControlManagement: {
    rbacConfiguration: any;
    abacConfiguration: any;
    privilegedAccess: any;
    accessReviews: any;
    accessProvisioning: any;
  };

  @ApiProperty({
    description: 'Security monitoring configuration',
    example: {
      securityMetrics: [],
      alertingConfiguration: {},
      logManagement: {},
      auditTrail: {},
      complianceMonitoring: {},
    },
  })
  @IsObject()
  securityMonitoring: {
    securityMetrics: any[];
    alertingConfiguration: any;
    logManagement: any;
    auditTrail: any;
    complianceMonitoring: any;
  };

  @ApiProperty({
    description: 'Incident response configuration',
    example: {
      incidentClassification: {},
      responsePlaybooks: [],
      escalationProcedures: [],
      forensicsConfiguration: {},
      recoveryProcedures: [],
    },
  })
  @IsObject()
  incidentResponse: {
    incidentClassification: any;
    responsePlaybooks: any[];
    escalationProcedures: any[];
    forensicsConfiguration: any;
    recoveryProcedures: any[];
  };

  @ApiProperty({
    description: 'Enterprise security configuration',
    example: {
      multiTenantSecurity: {},
      enterpriseIntegrations: [],
      securityGovernance: {},
      riskManagement: {},
      complianceFramework: {},
    },
  })
  @IsObject()
  enterpriseSecurityConfiguration: {
    multiTenantSecurity: any;
    enterpriseIntegrations: any[];
    securityGovernance: any;
    riskManagement: any;
    complianceFramework: any;
  };
}

export class UserSecurityValidationDto {
  @ApiProperty({
    description: 'User ID to validate security for',
    example: 'user_12345',
  })
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description: 'Additional validation scope',
    example: 'comprehensive',
  })
  @IsOptional()
  @IsString()
  validationScope?: string;

  @ApiPropertyOptional({
    description: 'Include Indonesian identity verification',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeIndonesianVerification?: boolean;
}

export class SecurityReportGenerationDto {
  @ApiProperty({
    description: 'Type of security report to generate',
    example: 'comprehensive_security_assessment',
  })
  @IsString()
  reportType: string;

  @ApiPropertyOptional({
    description: 'Scope of the security report',
    example: 'tenant_wide',
  })
  @IsOptional()
  @IsString()
  reportScope?: string;

  @ApiPropertyOptional({
    description: 'Include Indonesian regulatory compliance analysis',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeIndonesianCompliance?: boolean;

  @ApiPropertyOptional({
    description: 'Time range for the report',
    example: '30d',
  })
  @IsOptional()
  @IsString()
  timeRange?: string;
}

export class SecurityAuditDto {
  @ApiProperty({
    description: 'Type of security audit to perform',
    example: 'comprehensive_security_audit',
  })
  @IsString()
  auditType: string;

  @ApiPropertyOptional({
    description: 'Scope of the security audit',
    example: 'full_tenant',
  })
  @IsOptional()
  @IsString()
  auditScope?: string;

  @ApiPropertyOptional({
    description: 'Include Indonesian compliance audit',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeIndonesianCompliance?: boolean;

  @ApiPropertyOptional({
    description: 'Audit depth level',
    example: 'detailed',
  })
  @IsOptional()
  @IsString()
  auditDepth?: string;
}

export class SecurityComplianceCheckDto {
  @ApiProperty({
    description: 'Compliance framework to check against',
    example: 'indonesian_comprehensive',
  })
  @IsString()
  complianceFramework: string;

  @ApiPropertyOptional({
    description: 'Scope of compliance check',
    example: 'full_assessment',
  })
  @IsOptional()
  @IsString()
  checkScope?: string;

  @ApiPropertyOptional({
    description: 'Include automated remediation suggestions',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeRemediationSuggestions?: boolean;
}