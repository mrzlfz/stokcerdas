import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateCustomerPredictionTables1751810000000
  implements MigrationInterface
{
  name = 'CreateCustomerPredictionTables1751810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create customer_predictions table
    await queryRunner.createTable(
      new Table({
        name: 'customer_predictions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'prediction_type',
            type: 'enum',
            enum: [
              'churn_prediction',
              'ltv_forecasting',
              'next_purchase_prediction',
              'product_recommendation',
              'price_sensitivity_analysis',
              'seasonal_behavior_prediction',
              'payment_method_prediction',
              'risk_assessment',
              'engagement_prediction',
              'retention_probability',
            ],
            isNullable: false,
          },
          {
            name: 'model_type',
            type: 'enum',
            enum: [
              'logistic_regression',
              'random_forest',
              'gradient_boosting',
              'neural_network',
              'svm',
              'naive_bayes',
              'ensemble_model',
              'arima',
              'lstm',
              'prophet',
            ],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'pending',
              'processing',
              'completed',
              'failed',
              'expired',
              'updated',
            ],
            default: "'pending'",
          },
          {
            name: 'confidence',
            type: 'enum',
            enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
            isNullable: false,
          },
          {
            name: 'model_version',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'prediction_date',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'valid_until',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'prediction_features',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'prediction_result',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'indonesian_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'prediction_analytics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'accuracy_score',
            type: 'decimal',
            precision: 5,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'probability_score',
            type: 'decimal',
            precision: 5,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'confidence_score',
            type: 'decimal',
            precision: 5,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'business_impact_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'actionability_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'risk_level',
            type: 'int',
            default: 0,
          },
          {
            name: 'intervention_required',
            type: 'boolean',
            default: false,
          },
          {
            name: 'intervention_priority',
            type: 'int',
            default: 50,
          },
          {
            name: 'automated_actions_triggered',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'human_review_required',
            type: 'boolean',
            default: false,
          },
          {
            name: 'reviewed_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'review_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'custom_attributes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'internal_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for customer_predictions
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_customer',
        columnNames: ['tenant_id', 'customer_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_prediction_type',
        columnNames: ['tenant_id', 'prediction_type'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_model_type',
        columnNames: ['tenant_id', 'model_type'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_confidence',
        columnNames: ['tenant_id', 'confidence'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_prediction_date',
        columnNames: ['tenant_id', 'prediction_date'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_valid_until',
        columnNames: ['tenant_id', 'valid_until'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_risk_level',
        columnNames: ['tenant_id', 'risk_level'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_intervention_required',
        columnNames: ['tenant_id', 'intervention_required'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_intervention_priority',
        columnNames: ['tenant_id', 'intervention_priority'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_human_review_required',
        columnNames: ['tenant_id', 'human_review_required'],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_tenant_is_deleted',
        columnNames: ['tenant_id', 'is_deleted'],
      }),
    );

    // Advanced indexes for analytics and performance
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_analytics_composite_1',
        columnNames: [
          'tenant_id',
          'prediction_type',
          'status',
          'prediction_date',
        ],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_analytics_composite_2',
        columnNames: [
          'tenant_id',
          'customer_id',
          'prediction_type',
          'valid_until',
        ],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_business_impact_composite',
        columnNames: [
          'tenant_id',
          'prediction_type',
          'business_impact_score',
          'actionability_score',
        ],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_risk_assessment_composite',
        columnNames: [
          'tenant_id',
          'risk_level',
          'intervention_required',
          'intervention_priority',
        ],
      }),
    );
    await queryRunner.createIndex(
      'customer_predictions',
      new TableIndex({
        name: 'IDX_customer_predictions_model_performance_composite',
        columnNames: [
          'tenant_id',
          'model_type',
          'accuracy_score',
          'confidence_score',
        ],
      }),
    );

    // JSONB indexes for advanced analytics
    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_indonesian_context_gin 
      ON customer_predictions USING GIN (indonesian_context)
      WHERE tenant_id IS NOT NULL AND is_deleted = false
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_prediction_result_gin 
      ON customer_predictions USING GIN (prediction_result)
      WHERE tenant_id IS NOT NULL AND is_deleted = false
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_prediction_analytics_gin 
      ON customer_predictions USING GIN (prediction_analytics)
      WHERE tenant_id IS NOT NULL AND is_deleted = false
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_prediction_features_gin 
      ON customer_predictions USING GIN (prediction_features)
      WHERE tenant_id IS NOT NULL AND is_deleted = false
    `);

    // Specialized functional indexes for Indonesian business intelligence
    // Note: Simplified JSONB path to avoid complex casting syntax errors
    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_cultural_alignment 
      ON customer_predictions USING GIN (tenant_id, indonesian_context)
      WHERE tenant_id IS NOT NULL AND is_deleted = false AND indonesian_context IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_seasonal_patterns 
      ON customer_predictions USING GIN (tenant_id, prediction_result)
      WHERE tenant_id IS NOT NULL AND is_deleted = false AND prediction_result IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_business_intelligence 
      ON customer_predictions (tenant_id, prediction_type, business_impact_score)
      WHERE tenant_id IS NOT NULL AND is_deleted = false AND prediction_analytics IS NOT NULL
    `);

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'customer_predictions',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create partial indexes for frequently queried data
    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_active_high_risk 
      ON customer_predictions (tenant_id, customer_id, prediction_date)
      WHERE status = 'completed' AND risk_level > 70 AND is_deleted = false
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_churn_high_priority 
      ON customer_predictions (tenant_id, customer_id, probability_score, intervention_priority)
      WHERE prediction_type = 'churn_prediction' AND intervention_required = true AND is_deleted = false
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_ltv_forecasting_active 
      ON customer_predictions (tenant_id, customer_id, business_impact_score, valid_until)
      WHERE prediction_type = 'ltv_forecasting' AND status = 'completed' AND is_deleted = false
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_review_required 
      ON customer_predictions (tenant_id, human_review_required, intervention_priority, created_at)
      WHERE human_review_required = true AND reviewed_at IS NULL AND is_deleted = false
    `);

    // Create indexes for model performance monitoring
    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_model_monitoring 
      ON customer_predictions (model_type, model_version, accuracy_score, confidence_score, created_at)
      WHERE status = 'completed' AND is_deleted = false
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_customer_predictions_indonesian_optimization 
      ON customer_predictions (tenant_id, prediction_type)
      WHERE tenant_id IS NOT NULL AND is_deleted = false AND indonesian_context IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const customerPredictionsTable = await queryRunner.getTable(
      'customer_predictions',
    );

    if (customerPredictionsTable) {
      const foreignKeys = customerPredictionsTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('customer_predictions', foreignKey);
      }
    }

    // Drop all custom indexes
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_indonesian_context_gin',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_prediction_result_gin',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_prediction_analytics_gin',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_prediction_features_gin',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_cultural_alignment',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_seasonal_patterns',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_business_intelligence',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_active_high_risk',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_churn_high_priority',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_ltv_forecasting_active',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_review_required',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_model_monitoring',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_customer_predictions_indonesian_optimization',
    );

    // Drop table
    await queryRunner.dropTable('customer_predictions', true);
  }
}
