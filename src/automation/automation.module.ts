import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { ReorderRule, ReorderExecution } from './entities/reorder-rule.entity';
import {
  AutomationSchedule,
  ScheduleExecution,
} from './entities/automation-schedule.entity';
import { Workflow } from './entities/workflow.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import {
  WorkflowExecution,
  WorkflowStepExecution,
} from './entities/workflow-execution.entity';

// Controllers
import { AutomationController } from './controllers/automation.controller';
import { WorkflowController } from './controllers/workflow.controller';

// Services
import { ReorderCalculationService } from './services/reorder-calculation.service';
import { SupplierSelectionService } from './services/supplier-selection.service';
import { AutomatedPurchasingService } from './services/automated-purchasing.service';
import { AutomationRuleEngine } from './services/automation-rule-engine.service';
import { WorkflowBuilderService } from './services/workflow-builder.service';
import { WorkflowExecutionService } from './services/workflow-execution.service';
import { TriggerConfigurationService } from './services/trigger-configuration.service';
import { ActionTemplateService } from './services/action-template.service';

// Processors
import { AutomationProcessor } from './processors/automation.processor';
import { WorkflowProcessor } from './processors/workflow.processor';

// External Dependencies
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductsModule } from '../products/products.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { AlertsModule } from '../alerts/alerts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MLForecastingModule } from '../ml-forecasting/ml-forecasting.module';

// Import required entities from other modules
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Product } from '../products/entities/product.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    // TypeORM for database entities
    TypeOrmModule.forFeature([
      // Automation entities
      ReorderRule,
      ReorderExecution,
      AutomationSchedule,
      ScheduleExecution,

      // Workflow entities
      Workflow,
      WorkflowStep,
      WorkflowExecution,
      WorkflowStepExecution,

      // External entities needed by services
      InventoryItem,
      Product,
      Supplier,
      PurchaseOrder,
      User,
    ]),

    // Bull Queue for background job processing
    BullModule.registerQueue({
      name: 'automation',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 50, // Keep last 50 completed jobs
        removeOnFail: 100, // Keep last 100 failed jobs for debugging
      },
    }),

    // Bull Queue for workflow processing
    BullModule.registerQueue({
      name: 'workflow',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100, // Keep more workflow execution history
        removeOnFail: 200, // Keep more failed workflows for debugging
      },
    }),

    // Event Emitter for system events
    EventEmitterModule,

    // External module dependencies
    AuthModule,
    InventoryModule,
    ProductsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    AlertsModule,
    NotificationsModule,
    MLForecastingModule,
  ],

  controllers: [AutomationController, WorkflowController],

  providers: [
    // Core automation services
    ReorderCalculationService,
    SupplierSelectionService,
    AutomatedPurchasingService,
    AutomationRuleEngine,

    // Workflow automation services
    WorkflowBuilderService,
    WorkflowExecutionService,
    TriggerConfigurationService,
    ActionTemplateService,

    // Background job processors
    AutomationProcessor,
    WorkflowProcessor,
  ],

  exports: [
    // Export automation services for use in other modules
    ReorderCalculationService,
    SupplierSelectionService,
    AutomatedPurchasingService,
    AutomationRuleEngine,

    // Export workflow services for use in other modules
    WorkflowBuilderService,
    WorkflowExecutionService,
    TriggerConfigurationService,
    ActionTemplateService,

    // Export TypeORM repositories for direct access if needed
    TypeOrmModule,
  ],
})
export class AutomationModule {
  constructor() {
    // Module initialization logging
    console.log('🤖 AutomationModule initialized with:');
    console.log(
      '  ✅ Automation Entities: ReorderRule, ReorderExecution, AutomationSchedule, ScheduleExecution',
    );
    console.log(
      '  ✅ Workflow Entities: Workflow, WorkflowStep, WorkflowExecution, WorkflowStepExecution',
    );
    console.log(
      '  ✅ Automation Services: ReorderCalculation, SupplierSelection, AutomatedPurchasing, RuleEngine',
    );
    console.log(
      '  ✅ Workflow Services: WorkflowBuilder, WorkflowExecution, TriggerConfiguration, ActionTemplate',
    );
    console.log(
      '  ✅ Controllers: AutomationController (35+ endpoints), WorkflowController (50+ endpoints)',
    );
    console.log(
      '  ✅ Processors: AutomationProcessor (5 job types), WorkflowProcessor (8 job types)',
    );
    console.log(
      '  ✅ Queues: Bull queues for automation and workflow background processing',
    );
    console.log(
      '  ✅ Dependencies: Inventory, Products, Suppliers, PurchaseOrders, Alerts, Notifications, ML',
    );
    console.log('  🎯 Complete Task 11.2: Workflow Automation System Ready!');
  }
}
