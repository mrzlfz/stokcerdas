import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsNumber, 
  IsBoolean, 
  IsUUID, 
  IsArray, 
  IsObject, 
  ValidateNested, 
  Min, 
  Max, 
  IsDateString,
  IsEmail,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
  MaxLength,
  IsInt,
  IsPositive,
  Matches
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { 
  WorkflowCategory, 
  WorkflowTriggerType, 
  WorkflowPriority, 
  WorkflowStatus 
} from '../entities/workflow.entity';
import { 
  WorkflowStepType, 
  ConditionOperator, 
  DataTransformOperation 
} from '../entities/workflow-step.entity';

// =============================================
// WORKFLOW CONFIGURATION DTOS
// =============================================

export class TriggerConfigDto {
  @ApiPropertyOptional({
    description: 'Cron expression untuk scheduled trigger',
    example: '0 9 * * 1-5',
  })
  @IsOptional()
  @IsString({ message: 'Cron expression harus berupa string' })
  cronExpression?: string;

  @ApiPropertyOptional({
    description: 'Timezone untuk scheduled trigger',
    example: 'Asia/Jakarta',
    default: 'Asia/Jakarta',
  })
  @IsOptional()
  @IsString({ message: 'Timezone harus berupa string' })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Tanggal mulai untuk scheduled trigger',
    example: '2025-07-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date harus berupa tanggal yang valid' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Tanggal berakhir untuk scheduled trigger',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date harus berupa tanggal yang valid' })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Event type untuk event-based trigger',
    example: 'inventory.low_stock_detected',
  })
  @IsOptional()
  @IsString({ message: 'Event type harus berupa string' })
  eventType?: string;

  @ApiPropertyOptional({
    description: 'Filter untuk event-based trigger',
    example: { productCategory: 'electronics' },
  })
  @IsOptional()
  @IsObject({ message: 'Event filters harus berupa object' })
  eventFilters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Webhook URL untuk webhook trigger',
    example: 'https://api.example.com/webhook',
  })
  @IsOptional()
  @IsString({ message: 'Webhook URL harus berupa string' })
  webhookUrl?: string;

  @ApiPropertyOptional({
    description: 'Webhook secret untuk verifikasi',
  })
  @IsOptional()
  @IsString({ message: 'Webhook secret harus berupa string' })
  webhookSecret?: string;

  @ApiPropertyOptional({
    description: 'Conditions untuk condition-based trigger',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        operator: { type: 'string' },
        value: { type: 'any' },
      },
    },
  })
  @IsOptional()
  @IsArray({ message: 'Conditions harus berupa array' })
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
    logicalOperator?: 'AND' | 'OR';
  }>;

  @ApiPropertyOptional({
    description: 'Retry on failure untuk trigger',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Retry on failure harus berupa boolean' })
  retryOnFailure?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum retries untuk trigger',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Max retries harus berupa integer' })
  @Min(0, { message: 'Max retries tidak boleh kurang dari 0' })
  @Max(10, { message: 'Max retries tidak boleh lebih dari 10' })
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Timeout dalam detik',
    example: 300,
    minimum: 1,
    maximum: 3600,
  })
  @IsOptional()
  @IsInt({ message: 'Timeout harus berupa integer' })
  @Min(1, { message: 'Timeout minimal 1 detik' })
  @Max(3600, { message: 'Timeout maksimal 3600 detik (1 jam)' })
  timeout?: number;
}

export class WorkflowConfigDto {
  @ApiPropertyOptional({
    description: 'Allow concurrent execution',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Allow concurrent execution harus berupa boolean' })
  allowConcurrentExecution?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum concurrent executions',
    example: 3,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Max concurrent executions harus berupa integer' })
  @Min(1, { message: 'Max concurrent executions minimal 1' })
  @Max(10, { message: 'Max concurrent executions maksimal 10' })
  maxConcurrentExecutions?: number;

  @ApiPropertyOptional({
    description: 'Execution timeout dalam detik',
    example: 1800,
    minimum: 60,
    maximum: 7200,
  })
  @IsOptional()
  @IsInt({ message: 'Execution timeout harus berupa integer' })
  @Min(60, { message: 'Execution timeout minimal 60 detik' })
  @Max(7200, { message: 'Execution timeout maksimal 7200 detik (2 jam)' })
  executionTimeout?: number;

  @ApiPropertyOptional({
    description: 'On error action',
    enum: ['stop', 'continue', 'retry', 'skip'],
    default: 'stop',
  })
  @IsOptional()
  @IsEnum(['stop', 'continue', 'retry', 'skip'], { 
    message: 'On error action harus berupa: stop, continue, retry, atau skip' 
  })
  onErrorAction?: 'stop' | 'continue' | 'retry' | 'skip';

  @ApiPropertyOptional({
    description: 'Maximum error retries',
    example: 3,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsInt({ message: 'Max error retries harus berupa integer' })
  @Min(0, { message: 'Max error retries tidak boleh kurang dari 0' })
  @Max(5, { message: 'Max error retries tidak boleh lebih dari 5' })
  maxErrorRetries?: number;

  @ApiPropertyOptional({
    description: 'Send error notification',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Error notification harus berupa boolean' })
  errorNotification?: boolean;

  @ApiPropertyOptional({
    description: 'Resource group',
    example: 'high_priority',
  })
  @IsOptional()
  @IsString({ message: 'Resource group harus berupa string' })
  @MaxLength(50, { message: 'Resource group tidak boleh lebih dari 50 karakter' })
  resourceGroup?: string;

  @ApiPropertyOptional({
    description: 'Maximum memory usage dalam MB',
    example: 512,
    minimum: 128,
    maximum: 4096,
  })
  @IsOptional()
  @IsInt({ message: 'Max memory usage harus berupa integer' })
  @Min(128, { message: 'Max memory usage minimal 128 MB' })
  @Max(4096, { message: 'Max memory usage maksimal 4096 MB' })
  maxMemoryUsage?: number;

  @ApiPropertyOptional({
    description: 'Maximum CPU usage dalam persen',
    example: 80,
    minimum: 10,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'Max CPU usage harus berupa integer' })
  @Min(10, { message: 'Max CPU usage minimal 10%' })
  @Max(100, { message: 'Max CPU usage maksimal 100%' })
  maxCpuUsage?: number;
}

export class NotificationConfigDto {
  @ApiPropertyOptional({
    description: 'Send notification on workflow start',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Send on start harus berupa boolean' })
  sendOnStart?: boolean;

  @ApiPropertyOptional({
    description: 'Send notification on workflow success',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Send on success harus berupa boolean' })
  sendOnSuccess?: boolean;

  @ApiPropertyOptional({
    description: 'Send notification on workflow failure',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Send on failure harus berupa boolean' })
  sendOnFailure?: boolean;

  @ApiPropertyOptional({
    description: 'Send notification on workflow timeout',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Send on timeout harus berupa boolean' })
  sendOnTimeout?: boolean;

  @ApiPropertyOptional({
    description: 'Email recipients untuk notifikasi',
    type: [String],
    example: ['manager@company.com', 'admin@company.com'],
  })
  @IsOptional()
  @IsArray({ message: 'Email recipients harus berupa array' })
  @IsEmail({}, { each: true, message: 'Setiap email recipient harus berupa email yang valid' })
  emailRecipients?: string[];

  @ApiPropertyOptional({
    description: 'Slack channels untuk notifikasi',
    type: [String],
    example: ['#inventory-alerts', '#operations'],
  })
  @IsOptional()
  @IsArray({ message: 'Slack channels harus berupa array' })
  @IsString({ each: true, message: 'Setiap slack channel harus berupa string' })
  slackChannels?: string[];

  @ApiPropertyOptional({
    description: 'Webhook URLs untuk notifikasi',
    type: [String],
    example: ['https://hooks.slack.com/services/xxx'],
  })
  @IsOptional()
  @IsArray({ message: 'Webhook URLs harus berupa array' })
  @IsString({ each: true, message: 'Setiap webhook URL harus berupa string' })
  webhookUrls?: string[];

  @ApiPropertyOptional({
    description: 'Custom notification templates',
    example: {
      startTemplate: 'Workflow ${workflowName} telah dimulai',
      successTemplate: 'Workflow ${workflowName} berhasil diselesaikan',
      failureTemplate: 'Workflow ${workflowName} gagal: ${error}',
    },
  })
  @IsOptional()
  @IsObject({ message: 'Custom templates harus berupa object' })
  customTemplates?: {
    startTemplate?: string;
    successTemplate?: string;
    failureTemplate?: string;
    timeoutTemplate?: string;
  };
}

export class WorkflowVariableDto {
  @ApiProperty({
    description: 'Tipe variable',
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    example: 'string',
  })
  @IsEnum(['string', 'number', 'boolean', 'object', 'array'], { 
    message: 'Type harus berupa: string, number, boolean, object, atau array' 
  })
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';

  @ApiProperty({
    description: 'Nilai variable',
    example: 'default value',
  })
  value: any;

  @ApiPropertyOptional({
    description: 'Deskripsi variable',
    example: 'Product ID untuk diproses',
  })
  @IsOptional()
  @IsString({ message: 'Description harus berupa string' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Variable wajib diisi',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Required harus berupa boolean' })
  required?: boolean;

  @ApiPropertyOptional({
    description: 'Validasi rules untuk variable',
    example: { min: 1, max: 100 },
  })
  @IsOptional()
  @IsObject({ message: 'Validation harus berupa object' })
  validation?: Record<string, any>;
}

export class WorkflowPermissionsDto {
  @ApiPropertyOptional({
    description: 'User IDs yang dapat mengedit workflow',
    type: [String],
    example: ['user1', 'user2'],
  })
  @IsOptional()
  @IsArray({ message: 'Can edit harus berupa array' })
  @IsUUID(4, { each: true, message: 'Setiap user ID harus berupa UUID yang valid' })
  canEdit?: string[];

  @ApiPropertyOptional({
    description: 'User IDs yang dapat menjalankan workflow',
    type: [String],
    example: ['user1', 'user2', 'user3'],
  })
  @IsOptional()
  @IsArray({ message: 'Can execute harus berupa array' })
  @IsUUID(4, { each: true, message: 'Setiap user ID harus berupa UUID yang valid' })
  canExecute?: string[];

  @ApiPropertyOptional({
    description: 'User IDs yang dapat melihat workflow',
    type: [String],
    example: ['user1', 'user2', 'user3', 'user4'],
  })
  @IsOptional()
  @IsArray({ message: 'Can view harus berupa array' })
  @IsUUID(4, { each: true, message: 'Setiap user ID harus berupa UUID yang valid' })
  canView?: string[];

  @ApiPropertyOptional({
    description: 'Workflow dapat diakses publik',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is public harus berupa boolean' })
  isPublic?: boolean;
}

// =============================================
// WORKFLOW STEP CONFIGURATION DTOS
// =============================================

export class StepConditionDto {
  @ApiProperty({
    description: 'Field yang akan dievaluasi',
    example: 'currentStock',
  })
  @IsString({ message: 'Field harus berupa string' })
  @MinLength(1, { message: 'Field tidak boleh kosong' })
  field: string;

  @ApiProperty({
    description: 'Operator untuk kondisi',
    enum: ConditionOperator,
    example: ConditionOperator.LESS_THAN,
  })
  @IsEnum(ConditionOperator, { message: 'Operator harus berupa nilai yang valid' })
  operator: ConditionOperator;

  @ApiProperty({
    description: 'Nilai untuk perbandingan',
    example: 10,
  })
  value: any;

  @ApiPropertyOptional({
    description: 'Logical operator untuk multiple conditions',
    enum: ['AND', 'OR'],
    default: 'AND',
  })
  @IsOptional()
  @IsEnum(['AND', 'OR'], { message: 'Logical operator harus berupa AND atau OR' })
  logicalOperator?: 'AND' | 'OR';
}

export class StepConfigDto {
  @ApiPropertyOptional({
    description: 'Konfigurasi condition step',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  condition?: {
    field: string;
    operator: ConditionOperator;
    value: any;
    logicalOperator?: 'AND' | 'OR';
    conditions?: StepConditionDto[];
    trueStepId?: string;
    falseStepId?: string;
  };

  @ApiPropertyOptional({
    description: 'Konfigurasi delay step',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  delay?: {
    duration: number;
    unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
    dynamic?: boolean;
    delayExpression?: string;
  };

  @ApiPropertyOptional({
    description: 'Konfigurasi inventory operation',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  inventoryOperation?: {
    productId?: string;
    locationId?: string;
    quantity?: number;
    adjustmentType?: string;
    reason?: string;
    transferToLocationId?: string;
  };

  @ApiPropertyOptional({
    description: 'Konfigurasi purchase order operation',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  purchaseOrderOperation?: {
    supplierId?: string;
    productId?: string;
    quantity?: number;
    unitPrice?: number;
    approverUserId?: string;
    autoApprove?: boolean;
    deliveryDate?: string;
  };

  @ApiPropertyOptional({
    description: 'Konfigurasi notification',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  notification?: {
    recipients: string[];
    subject?: string;
    message: string;
    template?: string;
    attachments?: string[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
  };

  @ApiPropertyOptional({
    description: 'Konfigurasi API call',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  apiCall?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    authentication?: {
      type: 'bearer' | 'basic' | 'api_key';
      credentials: Record<string, string>;
    };
    timeout?: number;
    retries?: number;
  };

  @ApiPropertyOptional({
    description: 'Konfigurasi data transformation',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  dataTransform?: {
    operation: DataTransformOperation;
    sourceField?: string;
    targetField?: string;
    transformFunction?: string;
    parameters?: Record<string, any>;
  };
}

export class StepErrorHandlingDto {
  @ApiProperty({
    description: 'Aksi ketika step error',
    enum: ['stop', 'continue', 'retry', 'skip', 'goto_step'],
    example: 'retry',
  })
  @IsEnum(['stop', 'continue', 'retry', 'skip', 'goto_step'], { 
    message: 'On error harus berupa: stop, continue, retry, skip, atau goto_step' 
  })
  onError: 'stop' | 'continue' | 'retry' | 'skip' | 'goto_step';

  @ApiPropertyOptional({
    description: 'Maximum retries untuk step ini',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Max retries harus berupa integer' })
  @Min(0, { message: 'Max retries tidak boleh kurang dari 0' })
  @Max(10, { message: 'Max retries tidak boleh lebih dari 10' })
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Delay sebelum retry dalam milliseconds',
    example: 5000,
    minimum: 1000,
    maximum: 60000,
  })
  @IsOptional()
  @IsInt({ message: 'Retry delay harus berupa integer' })
  @Min(1000, { message: 'Retry delay minimal 1000 ms' })
  @Max(60000, { message: 'Retry delay maksimal 60000 ms' })
  retryDelay?: number;

  @ApiPropertyOptional({
    description: 'Step ID untuk fallback ketika error',
    example: 'fallback-step-id',
  })
  @IsOptional()
  @IsString({ message: 'Fallback step ID harus berupa string' })
  fallbackStepId?: string;

  @ApiPropertyOptional({
    description: 'Step ID untuk continue setelah error',
    example: 'continue-step-id',
  })
  @IsOptional()
  @IsString({ message: 'Continue step ID harus berupa string' })
  continueStepId?: string;

  @ApiPropertyOptional({
    description: 'Kirim notifikasi ketika error',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Error notification harus berupa boolean' })
  errorNotification?: boolean;

  @ApiPropertyOptional({
    description: 'Custom error handler function',
    example: '(error, context) => { /* custom handling */ }',
  })
  @IsOptional()
  @IsString({ message: 'Custom error handler harus berupa string' })
  customErrorHandler?: string;
}

export class StepDependenciesDto {
  @ApiPropertyOptional({
    description: 'Step IDs yang harus selesai sebelum step ini',
    type: [String],
    example: ['step1', 'step2'],
  })
  @IsOptional()
  @IsArray({ message: 'Required steps harus berupa array' })
  @IsString({ each: true, message: 'Setiap required step harus berupa string' })
  requiredSteps?: string[];

  @ApiPropertyOptional({
    description: 'Step IDs yang memblokir step ini',
    type: [String],
    example: ['blocking-step'],
  })
  @IsOptional()
  @IsArray({ message: 'Blocked by steps harus berupa array' })
  @IsString({ each: true, message: 'Setiap blocking step harus berupa string' })
  blockedBySteps?: string[];

  @ApiPropertyOptional({
    description: 'Variable names yang harus ada',
    type: [String],
    example: ['productId', 'quantity'],
  })
  @IsOptional()
  @IsArray({ message: 'Depends on variables harus berupa array' })
  @IsString({ each: true, message: 'Setiap variable name harus berupa string' })
  dependsOnVariables?: string[];

  @ApiPropertyOptional({
    description: 'Permissions yang diperlukan untuk execute step',
    type: [String],
    example: ['inventory:write', 'purchase:create'],
  })
  @IsOptional()
  @IsArray({ message: 'Required permissions harus berupa array' })
  @IsString({ each: true, message: 'Setiap permission harus berupa string' })
  requiredPermissions?: string[];
}

export class StepUiConfigDto {
  @ApiPropertyOptional({
    description: 'Posisi step dalam UI workflow designer',
    example: { x: 100, y: 200 },
  })
  @IsOptional()
  @IsObject({ message: 'Position harus berupa object' })
  position?: { x: number; y: number };

  @ApiPropertyOptional({
    description: 'Ukuran step dalam UI',
    example: { width: 120, height: 80 },
  })
  @IsOptional()
  @IsObject({ message: 'Size harus berupa object' })
  size?: { width: number; height: number };

  @ApiPropertyOptional({
    description: 'Warna step dalam UI',
    example: '#3498db',
  })
  @IsOptional()
  @IsString({ message: 'Color harus berupa string' })
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Color harus berupa hex color yang valid' })
  color?: string;

  @ApiPropertyOptional({
    description: 'Icon untuk step',
    example: 'fas fa-check',
  })
  @IsOptional()
  @IsString({ message: 'Icon harus berupa string' })
  icon?: string;

  @ApiPropertyOptional({
    description: 'Step collapsed dalam UI',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is collapsed harus berupa boolean' })
  isCollapsed?: boolean;

  @ApiPropertyOptional({
    description: 'Notes untuk step',
    example: 'This step handles low stock conditions',
  })
  @IsOptional()
  @IsString({ message: 'Notes harus berupa string' })
  @MaxLength(500, { message: 'Notes tidak boleh lebih dari 500 karakter' })
  notes?: string;
}

// =============================================
// MAIN WORKFLOW DTOS
// =============================================

export class CreateWorkflowDto {
  @ApiProperty({
    description: 'Nama workflow',
    example: 'Auto Reorder Workflow',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Nama workflow harus berupa string' })
  @MinLength(1, { message: 'Nama workflow tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama workflow tidak boleh lebih dari 100 karakter' })
  name: string;

  @ApiPropertyOptional({
    description: 'Deskripsi workflow',
    example: 'Workflow otomatis untuk melakukan reorder ketika stok rendah',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa string' })
  @MaxLength(500, { message: 'Deskripsi tidak boleh lebih dari 500 karakter' })
  description?: string;

  @ApiProperty({
    description: 'Kategori workflow',
    enum: WorkflowCategory,
    example: WorkflowCategory.INVENTORY_MANAGEMENT,
  })
  @IsEnum(WorkflowCategory, { message: 'Category harus berupa nilai yang valid' })
  category: WorkflowCategory;

  @ApiProperty({
    description: 'Tipe trigger workflow',
    enum: WorkflowTriggerType,
    example: WorkflowTriggerType.SCHEDULED,
  })
  @IsEnum(WorkflowTriggerType, { message: 'Trigger type harus berupa nilai yang valid' })
  triggerType: WorkflowTriggerType;

  @ApiPropertyOptional({
    description: 'Prioritas workflow',
    enum: WorkflowPriority,
    default: WorkflowPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(WorkflowPriority, { message: 'Priority harus berupa nilai yang valid' })
  priority?: WorkflowPriority;

  @ApiPropertyOptional({
    description: 'Konfigurasi trigger',
    type: TriggerConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TriggerConfigDto)
  triggerConfig?: TriggerConfigDto;

  @ApiPropertyOptional({
    description: 'Konfigurasi workflow',
    type: WorkflowConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowConfigDto)
  workflowConfig?: WorkflowConfigDto;

  @ApiPropertyOptional({
    description: 'Konfigurasi notifikasi',
    type: NotificationConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationConfigDto)
  notificationConfig?: NotificationConfigDto;

  @ApiPropertyOptional({
    description: 'Variables workflow',
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/WorkflowVariableDto' },
  })
  @IsOptional()
  @IsObject({ message: 'Variables harus berupa object' })
  variables?: Record<string, WorkflowVariableDto>;

  @ApiPropertyOptional({
    description: 'Tags untuk workflow',
    type: [String],
    example: ['automation', 'inventory', 'reorder'],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray({ message: 'Tags harus berupa array' })
  @ArrayMaxSize(10, { message: 'Tags maksimal 10 item' })
  @IsString({ each: true, message: 'Setiap tag harus berupa string' })
  @MaxLength(50, { each: true, message: 'Setiap tag tidak boleh lebih dari 50 karakter' })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Metadata tambahan',
    example: { department: 'operations', version: '1.0' },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata harus berupa object' })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'User ID owner workflow',
    example: 'user-123',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Owner ID harus berupa UUID yang valid' })
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Permissions untuk workflow',
    type: WorkflowPermissionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowPermissionsDto)
  permissions?: WorkflowPermissionsDto;
}

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {}

export class CreateWorkflowStepDto {
  @ApiProperty({
    description: 'Nama step',
    example: 'Check Stock Level',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Nama step harus berupa string' })
  @MinLength(1, { message: 'Nama step tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama step tidak boleh lebih dari 100 karakter' })
  name: string;

  @ApiPropertyOptional({
    description: 'Deskripsi step',
    example: 'Memeriksa level stok produk saat ini',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi step harus berupa string' })
  @MaxLength(500, { message: 'Deskripsi step tidak boleh lebih dari 500 karakter' })
  description?: string;

  @ApiProperty({
    description: 'Tipe step',
    enum: WorkflowStepType,
    example: WorkflowStepType.CHECK_STOCK_LEVEL,
  })
  @IsEnum(WorkflowStepType, { message: 'Step type harus berupa nilai yang valid' })
  stepType: WorkflowStepType;

  @ApiProperty({
    description: 'Urutan eksekusi step',
    example: 1,
    minimum: 0,
  })
  @IsInt({ message: 'Execution order harus berupa integer' })
  @Min(0, { message: 'Execution order tidak boleh kurang dari 0' })
  executionOrder: number;

  @ApiPropertyOptional({
    description: 'Konfigurasi step',
    type: StepConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StepConfigDto)
  stepConfig?: StepConfigDto;

  @ApiPropertyOptional({
    description: 'Input mapping untuk step',
    example: { productId: { source: 'workflow_variable', path: 'selectedProductId' } },
  })
  @IsOptional()
  @IsObject({ message: 'Input mapping harus berupa object' })
  inputMapping?: Record<string, {
    source: 'workflow_variable' | 'previous_step' | 'static_value' | 'user_input';
    path?: string;
    defaultValue?: any;
    required?: boolean;
    validation?: Record<string, any>;
  }>;

  @ApiPropertyOptional({
    description: 'Output mapping untuk step',
    example: { currentStock: { target: 'workflow_variable', path: 'stockLevel' } },
  })
  @IsOptional()
  @IsObject({ message: 'Output mapping harus berupa object' })
  outputMapping?: Record<string, {
    target: 'workflow_variable' | 'next_step' | 'workflow_output';
    path?: string;
    transform?: string;
  }>;

  @ApiPropertyOptional({
    description: 'Error handling untuk step',
    type: StepErrorHandlingDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StepErrorHandlingDto)
  errorHandling?: StepErrorHandlingDto;

  @ApiPropertyOptional({
    description: 'Conditions untuk eksekusi step',
    type: [StepConditionDto],
  })
  @IsOptional()
  @IsArray({ message: 'Execution conditions harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => StepConditionDto)
  executionConditions?: StepConditionDto[];

  @ApiPropertyOptional({
    description: 'Dependencies untuk step',
    type: StepDependenciesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StepDependenciesDto)
  dependencies?: StepDependenciesDto;

  @ApiPropertyOptional({
    description: 'Timeout untuk step dalam detik',
    example: 300,
    minimum: 1,
    maximum: 3600,
  })
  @IsOptional()
  @IsInt({ message: 'Timeout harus berupa integer' })
  @Min(1, { message: 'Timeout minimal 1 detik' })
  @Max(3600, { message: 'Timeout maksimal 3600 detik' })
  timeoutSeconds?: number;

  @ApiPropertyOptional({
    description: 'Maximum memory dalam MB',
    example: 256,
    minimum: 64,
    maximum: 2048,
  })
  @IsOptional()
  @IsInt({ message: 'Max memory harus berupa integer' })
  @Min(64, { message: 'Max memory minimal 64 MB' })
  @Max(2048, { message: 'Max memory maksimal 2048 MB' })
  maxMemoryMB?: number;

  @ApiPropertyOptional({
    description: 'Maximum CPU dalam persen',
    example: 80,
    minimum: 10,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'Max CPU harus berupa integer' })
  @Min(10, { message: 'Max CPU minimal 10%' })
  @Max(100, { message: 'Max CPU maksimal 100%' })
  maxCpuPercent?: number;

  @ApiPropertyOptional({
    description: 'Maximum retries untuk step',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Max retries harus berupa integer' })
  @Min(0, { message: 'Max retries tidak boleh kurang dari 0' })
  @Max(10, { message: 'Max retries tidak boleh lebih dari 10' })
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Retry delay dalam milliseconds',
    example: 5000,
    minimum: 1000,
    maximum: 60000,
  })
  @IsOptional()
  @IsInt({ message: 'Retry delay harus berupa integer' })
  @Min(1000, { message: 'Retry delay minimal 1000 ms' })
  @Max(60000, { message: 'Retry delay maksimal 60000 ms' })
  retryDelayMs?: number;

  @ApiPropertyOptional({
    description: 'Step bersifat optional',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is optional harus berupa boolean' })
  isOptional?: boolean;

  @ApiPropertyOptional({
    description: 'Step bisa diskip',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Can skip harus berupa boolean' })
  canSkip?: boolean;

  @ApiPropertyOptional({
    description: 'Step critical (error akan stop workflow)',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is critical harus berupa boolean' })
  isCritical?: boolean;

  @ApiPropertyOptional({
    description: 'UI configuration untuk step',
    type: StepUiConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StepUiConfigDto)
  uiConfig?: StepUiConfigDto;
}

export class UpdateWorkflowStepDto extends PartialType(CreateWorkflowStepDto) {}

// =============================================
// QUERY AND RESPONSE DTOS
// =============================================

export class WorkflowQueryDto {
  @ApiPropertyOptional({
    description: 'Filter berdasarkan kategori',
    enum: WorkflowCategory,
  })
  @IsOptional()
  @IsEnum(WorkflowCategory, { message: 'Category harus berupa nilai yang valid' })
  category?: WorkflowCategory;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status',
    enum: WorkflowStatus,
  })
  @IsOptional()
  @IsEnum(WorkflowStatus, { message: 'Status harus berupa nilai yang valid' })
  status?: WorkflowStatus;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan trigger type',
    enum: WorkflowTriggerType,
  })
  @IsOptional()
  @IsEnum(WorkflowTriggerType, { message: 'Trigger type harus berupa nilai yang valid' })
  triggerType?: WorkflowTriggerType;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan owner',
    example: 'user-123',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Owner ID harus berupa UUID yang valid' })
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Filter workflows yang aktif',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'Is active harus berupa boolean' })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search berdasarkan nama atau deskripsi',
    example: 'reorder',
  })
  @IsOptional()
  @IsString({ message: 'Search harus berupa string' })
  @MinLength(1, { message: 'Search tidak boleh kosong' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tags',
    type: [String],
    example: ['automation', 'inventory'],
  })
  @IsOptional()
  @IsArray({ message: 'Tags harus berupa array' })
  @IsString({ each: true, message: 'Setiap tag harus berupa string' })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Halaman',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt({ message: 'Page harus berupa integer' })
  @Min(1, { message: 'Page minimal 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Jumlah item per halaman',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt({ message: 'Limit harus berupa integer' })
  @Min(1, { message: 'Limit minimal 1' })
  @Max(100, { message: 'Limit maksimal 100' })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sortir berdasarkan field',
    example: 'createdAt',
    enum: ['name', 'createdAt', 'updatedAt', 'lastExecutionAt', 'totalExecutions'],
  })
  @IsOptional()
  @IsString({ message: 'Sort by harus berupa string' })
  @IsEnum(['name', 'createdAt', 'updatedAt', 'lastExecutionAt', 'totalExecutions'], {
    message: 'Sort by harus berupa: name, createdAt, updatedAt, lastExecutionAt, atau totalExecutions'
  })
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Arah sorting',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'], { message: 'Sort order harus berupa ASC atau DESC' })
  sortOrder?: 'ASC' | 'DESC';
}

export class TriggerWorkflowDto {
  @ApiPropertyOptional({
    description: 'Data input untuk workflow execution',
    example: { productId: 'prod-123', quantity: 50 },
  })
  @IsOptional()
  @IsObject({ message: 'Input data harus berupa object' })
  inputData?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Sumber trigger',
    example: 'manual_trigger',
  })
  @IsOptional()
  @IsString({ message: 'Trigger source harus berupa string' })
  triggerSource?: string;

  @ApiPropertyOptional({
    description: 'Dry run mode (tidak melakukan aksi sebenarnya)',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Dry run harus berupa boolean' })
  dryRun?: boolean;

  @ApiPropertyOptional({
    description: 'Force execution meskipun ada conditions yang tidak terpenuhi',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Force execution harus berupa boolean' })
  forceExecution?: boolean;
}

export class WorkflowValidationResultDto {
  @ApiProperty({
    description: 'Workflow valid atau tidak',
    example: true,
  })
  isValid: boolean;

  @ApiProperty({
    description: 'List error dalam validation',
    type: [String],
    example: ['Step "Check Stock" tidak memiliki konfigurasi yang valid'],
  })
  errors: string[];

  @ApiProperty({
    description: 'List warning dalam validation',
    type: [String],
    example: ['Step "Send Email" tidak memiliki fallback configuration'],
  })
  warnings: string[];

  @ApiProperty({
    description: 'List suggestions untuk improvement',
    type: [String],
    example: ['Pertimbangkan untuk menambahkan error handling pada step API call'],
  })
  suggestions: string[];
}

export class ReorderStepsDto {
  @ApiProperty({
    description: 'List step dengan order baru',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        stepId: { type: 'string' },
        order: { type: 'number' },
      },
    },
    example: [
      { stepId: 'step-1', order: 1 },
      { stepId: 'step-2', order: 2 },
      { stepId: 'step-3', order: 3 },
    ],
  })
  @IsArray({ message: 'Step orders harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => Object)
  stepOrders: Array<{
    stepId: string;
    order: number;
  }>;
}

export class CloneWorkflowDto {
  @ApiPropertyOptional({
    description: 'Nama baru untuk workflow clone',
    example: 'Auto Reorder Workflow - Copy',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'New name harus berupa string' })
  @MaxLength(100, { message: 'New name tidak boleh lebih dari 100 karakter' })
  newName?: string;

  @ApiPropertyOptional({
    description: 'Include execution history dalam clone',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include history harus berupa boolean' })
  includeHistory?: boolean;

  @ApiPropertyOptional({
    description: 'Include permissions dalam clone',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include permissions harus berupa boolean' })
  includePermissions?: boolean;
}