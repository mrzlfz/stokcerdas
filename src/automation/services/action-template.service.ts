import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

import {
  WorkflowStepType,
  ConditionOperator,
  DataTransformOperation,
} from '../entities/workflow-step.entity';
import { WorkflowCategory } from '../entities/workflow.entity';

export interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  stepType: WorkflowStepType;
  icon?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // in seconds
  configuration: any;
  inputSchema?: any;
  outputSchema?: any;
  documentation?: {
    usage: string;
    examples: Array<{
      title: string;
      description: string;
      configuration: any;
    }>;
    troubleshooting?: Array<{
      issue: string;
      solution: string;
    }>;
  };
  metadata?: {
    author: string;
    version: string;
    lastUpdated: string;
    dependencies?: string[];
    limitations?: string[];
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  icon?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // in minutes
  steps: Array<{
    name: string;
    description: string;
    templateId: string;
    configuration: any;
    executionOrder: number;
  }>;
  variables?: Record<
    string,
    {
      type: string;
      description: string;
      defaultValue?: any;
      required?: boolean;
    }
  >;
  documentation?: {
    overview: string;
    useCases: string[];
    setupInstructions: string[];
    examples?: any[];
  };
  metadata?: {
    author: string;
    version: string;
    lastUpdated: string;
    popularity?: number;
    successRate?: number;
  };
}

@Injectable()
export class ActionTemplateService {
  private readonly logger = new Logger(ActionTemplateService.name);
  private readonly cachePrefix = 'action_templates';

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  // =============================================
  // ACTION TEMPLATE MANAGEMENT
  // =============================================

  async getActionTemplates(
    category?: string,
    difficulty?: string,
  ): Promise<ActionTemplate[]> {
    const cacheKey = `${this.cachePrefix}:actions:${category || 'all'}:${
      difficulty || 'all'
    }`;

    let templates = await this.cacheManager.get<ActionTemplate[]>(cacheKey);
    if (!templates) {
      templates = this.loadActionTemplates();

      // Filter by category and difficulty if specified
      if (category) {
        templates = templates.filter(t => t.category === category);
      }
      if (difficulty) {
        templates = templates.filter(t => t.difficulty === difficulty);
      }

      await this.cacheManager.set(cacheKey, templates, 3600); // 1 hour
    }

    return templates;
  }

  async getActionTemplate(templateId: string): Promise<ActionTemplate | null> {
    const templates = await this.getActionTemplates();
    return templates.find(t => t.id === templateId) || null;
  }

  async getWorkflowTemplates(
    category?: WorkflowCategory,
  ): Promise<WorkflowTemplate[]> {
    const cacheKey = `${this.cachePrefix}:workflows:${category || 'all'}`;

    let templates = await this.cacheManager.get<WorkflowTemplate[]>(cacheKey);
    if (!templates) {
      templates = this.loadWorkflowTemplates();

      if (category) {
        templates = templates.filter(t => t.category === category);
      }

      await this.cacheManager.set(cacheKey, templates, 3600);
    }

    return templates;
  }

  async getWorkflowTemplate(
    templateId: string,
  ): Promise<WorkflowTemplate | null> {
    const templates = await this.getWorkflowTemplates();
    return templates.find(t => t.id === templateId) || null;
  }

  async searchTemplates(
    query: string,
    type: 'action' | 'workflow' | 'both' = 'both',
  ): Promise<{
    actionTemplates: ActionTemplate[];
    workflowTemplates: WorkflowTemplate[];
  }> {
    const result = {
      actionTemplates: [] as ActionTemplate[],
      workflowTemplates: [] as WorkflowTemplate[],
    };

    if (type === 'action' || type === 'both') {
      const actionTemplates = await this.getActionTemplates();
      result.actionTemplates = actionTemplates.filter(
        t =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.description.toLowerCase().includes(query.toLowerCase()) ||
          t.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())),
      );
    }

    if (type === 'workflow' || type === 'both') {
      const workflowTemplates = await this.getWorkflowTemplates();
      result.workflowTemplates = workflowTemplates.filter(
        t =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.description.toLowerCase().includes(query.toLowerCase()) ||
          t.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())),
      );
    }

    return result;
  }

  // =============================================
  // TEMPLATE CONFIGURATION GENERATION
  // =============================================

  generateStepConfiguration(templateId: string, customConfig?: any): any {
    const template = this.loadActionTemplates().find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} tidak ditemukan`);
    }

    // Merge template configuration with custom overrides
    return {
      ...template.configuration,
      ...customConfig,
    };
  }

  validateTemplateConfiguration(
    templateId: string,
    configuration: any,
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const template = this.loadActionTemplates().find(t => t.id === templateId);
    if (!template) {
      return {
        isValid: false,
        errors: [`Template ${templateId} tidak ditemukan`],
        warnings: [],
      };
    }

    // Basic validation - in a full implementation this would be more comprehensive
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields based on step type
    this.validateStepTypeConfiguration(
      template.stepType,
      configuration,
      errors,
      warnings,
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // =============================================
  // PREDEFINED TEMPLATES
  // =============================================

  private loadActionTemplates(): ActionTemplate[] {
    return [
      // Inventory Management Templates
      {
        id: 'inventory_check_stock_level',
        name: 'Check Stock Level',
        description:
          'Memeriksa level stok produk dan mengambil tindakan berdasarkan kondisi tertentu',
        category: 'inventory',
        stepType: WorkflowStepType.CHECK_STOCK_LEVEL,
        icon: '📦',
        tags: ['inventory', 'stock', 'monitoring'],
        difficulty: 'beginner',
        estimatedDuration: 5,
        configuration: {
          inventoryOperation: {
            productId: '${productId}',
            locationId: '${locationId}',
          },
        },
        inputSchema: {
          productId: { type: 'string', required: true },
          locationId: { type: 'string', required: false },
        },
        outputSchema: {
          currentStock: { type: 'number' },
          stockStatus: { type: 'string' },
          isLowStock: { type: 'boolean' },
        },
        documentation: {
          usage:
            'Gunakan action ini untuk memeriksa level stok produk secara real-time',
          examples: [
            {
              title: 'Check stock untuk produk tertentu',
              description: 'Memeriksa stok produk dengan ID tertentu',
              configuration: {
                inventoryOperation: {
                  productId: 'prod-123',
                  locationId: 'loc-456',
                },
              },
            },
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
        },
      },

      {
        id: 'inventory_create_adjustment',
        name: 'Create Stock Adjustment',
        description: 'Membuat penyesuaian stok untuk koreksi inventory',
        category: 'inventory',
        stepType: WorkflowStepType.CREATE_ADJUSTMENT,
        icon: '📝',
        tags: ['inventory', 'adjustment', 'correction'],
        difficulty: 'intermediate',
        estimatedDuration: 10,
        configuration: {
          inventoryOperation: {
            productId: '${productId}',
            locationId: '${locationId}',
            quantity: '${adjustmentQuantity}',
            adjustmentType: '${adjustmentType}',
            reason: '${reason}',
          },
        },
        inputSchema: {
          productId: { type: 'string', required: true },
          locationId: { type: 'string', required: true },
          adjustmentQuantity: { type: 'number', required: true },
          adjustmentType: {
            type: 'string',
            enum: ['increase', 'decrease'],
            required: true,
          },
          reason: { type: 'string', required: true },
        },
        documentation: {
          usage:
            'Gunakan untuk melakukan penyesuaian stok manual atau otomatis',
          examples: [
            {
              title: 'Koreksi stok karena stock opname',
              description: 'Menyesuaikan stok berdasarkan hasil stock opname',
              configuration: {
                inventoryOperation: {
                  productId: 'prod-123',
                  locationId: 'warehouse-001',
                  quantity: -5,
                  adjustmentType: 'decrease',
                  reason: 'Stock opname correction',
                },
              },
            },
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
        },
      },

      // Purchase Order Templates
      {
        id: 'po_create_purchase_order',
        name: 'Create Purchase Order',
        description: 'Membuat purchase order baru secara otomatis',
        category: 'purchase_order',
        stepType: WorkflowStepType.CREATE_PURCHASE_ORDER,
        icon: '🛒',
        tags: ['purchase', 'order', 'supplier'],
        difficulty: 'intermediate',
        estimatedDuration: 15,
        configuration: {
          purchaseOrderOperation: {
            supplierId: '${supplierId}',
            productId: '${productId}',
            quantity: '${orderQuantity}',
            unitPrice: '${unitPrice}',
            deliveryDate: '${deliveryDate}',
            autoApprove: false,
          },
        },
        inputSchema: {
          supplierId: { type: 'string', required: true },
          productId: { type: 'string', required: true },
          orderQuantity: { type: 'number', required: true },
          unitPrice: { type: 'number', required: false },
          deliveryDate: { type: 'string', format: 'date', required: false },
        },
        outputSchema: {
          purchaseOrderId: { type: 'string' },
          orderStatus: { type: 'string' },
          totalAmount: { type: 'number' },
        },
        documentation: {
          usage:
            'Membuat PO otomatis berdasarkan reorder rules atau manual trigger',
          examples: [
            {
              title: 'PO otomatis untuk reorder',
              description: 'Membuat PO ketika stok mencapai reorder point',
              configuration: {
                purchaseOrderOperation: {
                  supplierId: 'supp-001',
                  productId: 'prod-123',
                  quantity: 100,
                  autoApprove: false,
                },
              },
            },
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
        },
      },

      // Notification Templates
      {
        id: 'notification_send_email',
        name: 'Send Email Notification',
        description:
          'Mengirim notifikasi email dengan template yang dapat dikustomisasi',
        category: 'notification',
        stepType: WorkflowStepType.SEND_EMAIL,
        icon: '📧',
        tags: ['notification', 'email', 'alert'],
        difficulty: 'beginner',
        estimatedDuration: 3,
        configuration: {
          notification: {
            recipients: ['${emailRecipients}'],
            subject: '${emailSubject}',
            message: '${emailMessage}',
            template: 'default',
            priority: 'normal',
          },
        },
        inputSchema: {
          emailRecipients: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            required: true,
          },
          emailSubject: { type: 'string', required: true },
          emailMessage: { type: 'string', required: true },
          template: { type: 'string', required: false },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'critical'],
            required: false,
          },
        },
        documentation: {
          usage: 'Kirim email notification untuk berbagai event dalam workflow',
          examples: [
            {
              title: 'Low stock alert email',
              description: 'Kirim alert ketika stok produk rendah',
              configuration: {
                notification: {
                  recipients: ['manager@company.com'],
                  subject: 'Low Stock Alert: ${productName}',
                  message:
                    'Stok produk ${productName} sudah mencapai level minimum. Silakan lakukan reorder.',
                  priority: 'high',
                },
              },
            },
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
        },
      },

      // Data Processing Templates
      {
        id: 'data_transform_map',
        name: 'Transform Data (Map)',
        description: 'Mentransformasi data dengan operasi mapping',
        category: 'data_processing',
        stepType: WorkflowStepType.DATA_TRANSFORM,
        icon: '🔄',
        tags: ['data', 'transform', 'mapping'],
        difficulty: 'intermediate',
        estimatedDuration: 5,
        configuration: {
          dataTransform: {
            operation: DataTransformOperation.MAP,
            sourceField: '${sourceField}',
            targetField: '${targetField}',
            transformFunction: '${transformFunction}',
          },
        },
        inputSchema: {
          sourceField: { type: 'string', required: true },
          targetField: { type: 'string', required: true },
          transformFunction: { type: 'string', required: true },
        },
        documentation: {
          usage:
            'Transform data struktur untuk memformat output sesuai kebutuhan',
          examples: [
            {
              title: 'Format currency values',
              description: 'Convert numeric values to Indonesian Rupiah format',
              configuration: {
                dataTransform: {
                  operation: 'map',
                  sourceField: 'price',
                  targetField: 'formattedPrice',
                  transformFunction:
                    'value => "Rp " + value.toLocaleString("id-ID")',
                },
              },
            },
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
        },
      },

      // Condition Templates
      {
        id: 'condition_stock_level_check',
        name: 'Stock Level Condition',
        description: 'Mengecek kondisi level stok dan menentukan alur workflow',
        category: 'condition',
        stepType: WorkflowStepType.CONDITION,
        icon: '❓',
        tags: ['condition', 'stock', 'decision'],
        difficulty: 'beginner',
        estimatedDuration: 2,
        configuration: {
          condition: {
            field: 'currentStock',
            operator: ConditionOperator.LESS_THAN,
            value: '${minimumStock}',
            trueStepId: '${lowStockStepId}',
            falseStepId: '${sufficientStockStepId}',
          },
        },
        inputSchema: {
          minimumStock: { type: 'number', required: true },
          lowStockStepId: { type: 'string', required: true },
          sufficientStockStepId: { type: 'string', required: false },
        },
        documentation: {
          usage:
            'Gunakan untuk membuat cabang dalam workflow berdasarkan kondisi stok',
          examples: [
            {
              title: 'Low stock decision',
              description: 'Tentukan aksi berdasarkan level stok',
              configuration: {
                condition: {
                  field: 'currentStock',
                  operator: 'less_than',
                  value: 10,
                  trueStepId: 'create_purchase_order',
                  falseStepId: 'send_stock_ok_notification',
                },
              },
            },
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
        },
      },

      // API Integration Templates
      {
        id: 'api_call_generic',
        name: 'Generic API Call',
        description: 'Melakukan panggilan API ke endpoint eksternal',
        category: 'integration',
        stepType: WorkflowStepType.API_CALL,
        icon: '🌐',
        tags: ['api', 'integration', 'external'],
        difficulty: 'advanced',
        estimatedDuration: 10,
        configuration: {
          apiCall: {
            url: '${apiUrl}',
            method: '${httpMethod}',
            headers: {
              'Content-Type': 'application/json',
              Authorization: '${authHeader}',
            },
            body: '${requestBody}',
            timeout: 30000,
            retries: 3,
          },
        },
        inputSchema: {
          apiUrl: { type: 'string', format: 'uri', required: true },
          httpMethod: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            required: true,
          },
          authHeader: { type: 'string', required: false },
          requestBody: { type: 'object', required: false },
        },
        outputSchema: {
          statusCode: { type: 'number' },
          responseData: { type: 'object' },
          responseTime: { type: 'number' },
        },
        documentation: {
          usage:
            'Integrasikan dengan API eksternal untuk sinkronisasi data atau trigger action',
          examples: [
            {
              title: 'Sync product to e-commerce',
              description: 'Sinkronisasi produk ke marketplace',
              configuration: {
                apiCall: {
                  url: 'https://api.tokopedia.com/v1/products',
                  method: 'POST',
                  headers: {
                    Authorization: 'Bearer ${accessToken}',
                    'Content-Type': 'application/json',
                  },
                  body: {
                    name: '${productName}',
                    price: '${productPrice}',
                    stock: '${productStock}',
                  },
                },
              },
            },
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
        },
      },

      // Delay Templates
      {
        id: 'delay_fixed_time',
        name: 'Fixed Time Delay',
        description: 'Menunggu untuk jangka waktu tertentu sebelum melanjutkan',
        category: 'control_flow',
        stepType: WorkflowStepType.DELAY,
        icon: '⏰',
        tags: ['delay', 'wait', 'timing'],
        difficulty: 'beginner',
        estimatedDuration: 1,
        configuration: {
          delay: {
            duration: '${delayDuration}',
            unit: '${delayUnit}',
          },
        },
        inputSchema: {
          delayDuration: { type: 'number', required: true },
          delayUnit: {
            type: 'string',
            enum: ['ms', 'seconds', 'minutes', 'hours', 'days'],
            required: true,
          },
        },
        documentation: {
          usage:
            'Tambahkan jeda waktu dalam workflow untuk rate limiting atau timing control',
          examples: [
            {
              title: 'Wait before retry',
              description: 'Tunggu 30 detik sebelum retry API call',
              configuration: {
                delay: {
                  duration: 30,
                  unit: 'seconds',
                },
              },
            },
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
        },
      },
    ];
  }

  private loadWorkflowTemplates(): WorkflowTemplate[] {
    return [
      {
        id: 'auto_reorder_workflow',
        name: 'Automatic Reorder Workflow',
        description:
          'Workflow otomatis untuk melakukan reorder ketika stok mencapai level minimum',
        category: WorkflowCategory.INVENTORY_MANAGEMENT,
        icon: '🔄',
        tags: ['reorder', 'automation', 'inventory'],
        difficulty: 'intermediate',
        estimatedDuration: 15,
        steps: [
          {
            name: 'Check Stock Level',
            description: 'Memeriksa level stok saat ini',
            templateId: 'inventory_check_stock_level',
            configuration: {},
            executionOrder: 1,
          },
          {
            name: 'Stock Level Decision',
            description: 'Menentukan apakah perlu reorder berdasarkan stok',
            templateId: 'condition_stock_level_check',
            configuration: {},
            executionOrder: 2,
          },
          {
            name: 'Create Purchase Order',
            description: 'Membuat PO jika stok rendah',
            templateId: 'po_create_purchase_order',
            configuration: {},
            executionOrder: 3,
          },
          {
            name: 'Send Notification',
            description: 'Kirim notifikasi PO telah dibuat',
            templateId: 'notification_send_email',
            configuration: {},
            executionOrder: 4,
          },
        ],
        variables: {
          productId: {
            type: 'string',
            description: 'ID produk yang akan dicek',
            required: true,
          },
          minimumStock: {
            type: 'number',
            description: 'Level minimum stok untuk trigger reorder',
            defaultValue: 10,
            required: true,
          },
          reorderQuantity: {
            type: 'number',
            description: 'Jumlah yang akan dipesan',
            defaultValue: 100,
            required: true,
          },
          supplierId: {
            type: 'string',
            description: 'ID supplier untuk pemesanan',
            required: true,
          },
        },
        documentation: {
          overview:
            'Workflow ini secara otomatis memonitor level stok dan membuat purchase order ketika stok mencapai level minimum yang ditentukan.',
          useCases: [
            'Automatic reordering untuk fast-moving products',
            'Mencegah stockout pada produk kritis',
            'Mengoptimalkan inventory turnover',
          ],
          setupInstructions: [
            'Set minimum stock level untuk setiap produk',
            'Configure supplier information',
            'Setup email notifications untuk approval',
            'Test workflow dengan dry run',
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
          popularity: 95,
          successRate: 98.5,
        },
      },

      {
        id: 'low_stock_alert_workflow',
        name: 'Low Stock Alert Workflow',
        description: 'Workflow untuk mengirim alert ketika stok produk rendah',
        category: WorkflowCategory.ALERT_NOTIFICATION,
        icon: '⚠️',
        tags: ['alert', 'notification', 'low-stock'],
        difficulty: 'beginner',
        estimatedDuration: 5,
        steps: [
          {
            name: 'Check Stock Level',
            description: 'Monitor level stok produk',
            templateId: 'inventory_check_stock_level',
            configuration: {},
            executionOrder: 1,
          },
          {
            name: 'Low Stock Condition',
            description: 'Cek apakah stok di bawah threshold',
            templateId: 'condition_stock_level_check',
            configuration: {},
            executionOrder: 2,
          },
          {
            name: 'Send Alert Email',
            description: 'Kirim email alert ke manager',
            templateId: 'notification_send_email',
            configuration: {
              notification: {
                subject: 'Low Stock Alert: ${productName}',
                template: 'low_stock_alert',
                priority: 'high',
              },
            },
            executionOrder: 3,
          },
        ],
        variables: {
          productId: {
            type: 'string',
            description: 'Product ID to monitor',
            required: true,
          },
          alertThreshold: {
            type: 'number',
            description: 'Stock level threshold for alert',
            defaultValue: 20,
            required: true,
          },
          managerEmail: {
            type: 'string',
            description: 'Email manager untuk notifikasi',
            required: true,
          },
        },
        documentation: {
          overview:
            'Simple workflow untuk monitoring stok dan mengirim alert ketika stok mencapai level rendah.',
          useCases: [
            'Daily stock monitoring',
            'Preventive stock management',
            'Manager notifications',
          ],
          setupInstructions: [
            'Configure alert threshold untuk setiap produk',
            'Setup manager email list',
            'Schedule workflow untuk run setiap hari',
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
          popularity: 89,
          successRate: 99.2,
        },
      },

      {
        id: 'supplier_performance_review',
        name: 'Supplier Performance Review',
        description:
          'Workflow untuk review dan evaluasi performa supplier secara berkala',
        category: WorkflowCategory.SUPPLIER_MANAGEMENT,
        icon: '📊',
        tags: ['supplier', 'performance', 'review'],
        difficulty: 'advanced',
        estimatedDuration: 30,
        steps: [
          {
            name: 'Collect Supplier Data',
            description: 'Kumpulkan data performa supplier',
            templateId: 'api_call_generic',
            configuration: {},
            executionOrder: 1,
          },
          {
            name: 'Calculate Performance Metrics',
            description: 'Hitung metrics performa',
            templateId: 'data_transform_map',
            configuration: {},
            executionOrder: 2,
          },
          {
            name: 'Generate Performance Report',
            description: 'Generate laporan performa',
            templateId: 'data_transform_map',
            configuration: {},
            executionOrder: 3,
          },
          {
            name: 'Send Report to Management',
            description: 'Kirim laporan ke management',
            templateId: 'notification_send_email',
            configuration: {},
            executionOrder: 4,
          },
        ],
        variables: {
          supplierId: {
            type: 'string',
            description: 'Supplier ID untuk review',
            required: true,
          },
          reviewPeriod: {
            type: 'string',
            description: 'Periode review (monthly/quarterly)',
            defaultValue: 'monthly',
            required: true,
          },
        },
        documentation: {
          overview:
            'Comprehensive workflow untuk melakukan review performa supplier secara sistematis.',
          useCases: [
            'Monthly supplier review',
            'Supplier contract renewal evaluation',
            'Performance tracking dan improvement',
          ],
          setupInstructions: [
            'Configure performance metrics yang akan dievaluasi',
            'Setup data sources untuk supplier performance',
            'Configure report template',
            'Schedule periodic execution',
          ],
        },
        metadata: {
          author: 'StokCerdas Team',
          version: '1.0.0',
          lastUpdated: '2025-06-30',
          popularity: 75,
          successRate: 96.8,
        },
      },
    ];
  }

  private validateStepTypeConfiguration(
    stepType: WorkflowStepType,
    configuration: any,
    errors: string[],
    warnings: string[],
  ): void {
    switch (stepType) {
      case WorkflowStepType.CONDITION:
        if (!configuration.condition?.field) {
          errors.push('Field diperlukan untuk condition step');
        }
        if (!configuration.condition?.operator) {
          errors.push('Operator diperlukan untuk condition step');
        }
        break;

      case WorkflowStepType.API_CALL:
        if (!configuration.apiCall?.url) {
          errors.push('URL diperlukan untuk API call step');
        }
        if (!configuration.apiCall?.method) {
          errors.push('HTTP method diperlukan untuk API call step');
        }
        break;

      case WorkflowStepType.SEND_EMAIL:
        if (!configuration.notification?.recipients?.length) {
          errors.push('Recipients diperlukan untuk email step');
        }
        if (!configuration.notification?.subject) {
          errors.push('Subject diperlukan untuk email step');
        }
        break;

      case WorkflowStepType.DELAY:
        if (
          !configuration.delay?.duration ||
          configuration.delay.duration <= 0
        ) {
          errors.push('Duration harus > 0 untuk delay step');
        }
        if (!configuration.delay?.unit) {
          errors.push('Unit diperlukan untuk delay step');
        }
        break;

      case WorkflowStepType.CREATE_PURCHASE_ORDER:
        if (!configuration.purchaseOrderOperation?.supplierId) {
          errors.push('Supplier ID diperlukan untuk create PO step');
        }
        if (!configuration.purchaseOrderOperation?.productId) {
          errors.push('Product ID diperlukan untuk create PO step');
        }
        if (
          !configuration.purchaseOrderOperation?.quantity ||
          configuration.purchaseOrderOperation.quantity <= 0
        ) {
          errors.push('Quantity harus > 0 untuk create PO step');
        }
        break;

      case WorkflowStepType.CHECK_STOCK_LEVEL:
        if (!configuration.inventoryOperation?.productId) {
          errors.push('Product ID diperlukan untuk check stock step');
        }
        break;

      case WorkflowStepType.DATA_TRANSFORM:
        if (!configuration.dataTransform?.operation) {
          errors.push('Operation diperlukan untuk data transform step');
        }
        if (!configuration.dataTransform?.sourceField) {
          warnings.push('Source field tidak didefinisikan');
        }
        break;

      default:
        // No specific validation for other step types
        break;
    }
  }
}
