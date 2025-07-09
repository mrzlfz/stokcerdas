import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMLTables1751820000000 implements MigrationInterface {
  name = 'CreateMLTables1751820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types for ML models
    await queryRunner.query(`
      CREATE TYPE "model_type_enum" AS ENUM(
        'arima',
        'prophet',
        'xgboost',
        'linear_regression',
        'exponential_smoothing',
        'ensemble'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "model_status_enum" AS ENUM(
        'training',
        'trained',
        'deployed',
        'failed',
        'deprecated'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "forecast_horizon_enum" AS ENUM(
        'daily',
        'weekly',
        'monthly'
      );
    `);

    // Create ENUM types for training jobs
    await queryRunner.query(`
      CREATE TYPE "training_job_type_enum" AS ENUM(
        'initial_training',
        'retraining',
        'hyperparameter_tuning',
        'ensemble_training'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "training_job_status_enum" AS ENUM(
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled'
      );
    `);

    // Create ENUM types for predictions
    await queryRunner.query(`
      CREATE TYPE "prediction_type_enum" AS ENUM(
        'demand_forecast',
        'stockout_risk',
        'optimal_reorder',
        'price_elasticity',
        'seasonal_trend',
        'inventory_turnover'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "prediction_status_enum" AS ENUM(
        'pending',
        'completed',
        'failed',
        'expired'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "confidence_level_enum" AS ENUM(
        'low',
        'medium',
        'high',
        'very_high'
      );
    `);

    // Create ml_models table
    await queryRunner.query(`
      CREATE TABLE "ml_models" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying(100) NOT NULL,
        "description" text,
        "model_type" "model_type_enum" NOT NULL,
        "status" "model_status_enum" NOT NULL DEFAULT 'training',
        "forecast_horizon" "forecast_horizon_enum" NOT NULL DEFAULT 'daily',
        "product_id" uuid,
        "category_id" uuid,
        "location_id" character varying(100),
        "hyperparameters" jsonb NOT NULL,
        "version" character varying(50) NOT NULL DEFAULT 'v1.0',
        "configuration" jsonb,
        "training_config" jsonb,
        "performance" jsonb,
        "model_path" character varying(255),
        "forecast_days" integer NOT NULL DEFAULT 30,
        "accuracy_threshold" decimal(5,4) NOT NULL DEFAULT 0.85,
        "accuracy" decimal(5,4),
        "data_quality" decimal(5,4),
        "is_active" boolean NOT NULL DEFAULT true,
        "is_ensemble_member" boolean NOT NULL DEFAULT false,
        "parent_ensemble_id" uuid,
        "ensemble_weight" decimal(5,4),
        "trained_at" TIMESTAMP,
        "deployed_at" TIMESTAMP,
        "last_prediction_at" TIMESTAMP,
        "next_retraining_at" TIMESTAMP,
        "retraining_interval_days" integer NOT NULL DEFAULT 30,
        "feature_importance" jsonb,
        "seasonality_components" jsonb,
        "metadata" jsonb,
        CONSTRAINT "PK_ml_models" PRIMARY KEY ("id")
      );
    `);

    // Create training_jobs table
    await queryRunner.query(`
      CREATE TABLE "training_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "model_id" uuid NOT NULL,
        "job_type" "training_job_type_enum" NOT NULL DEFAULT 'initial_training',
        "status" "training_job_status_enum" NOT NULL DEFAULT 'queued',
        "queue_job_id" character varying(100),
        "training_config" jsonb NOT NULL,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "duration" integer,
        "progress" integer NOT NULL DEFAULT 0,
        "current_step" character varying(255),
        "training_metrics" jsonb,
        "performance_metrics" jsonb,
        "hyperparameter_results" jsonb,
        "error_message" text,
        "error_details" jsonb,
        "logs" jsonb,
        "job_id" character varying(255),
        "retry_count" integer NOT NULL DEFAULT 0,
        "max_retries" integer NOT NULL DEFAULT 3,
        "priority" character varying(20) NOT NULL DEFAULT 'medium',
        "estimated_duration" integer,
        "resource_usage" jsonb,
        "artifacts" jsonb,
        "cancelled_at" TIMESTAMP,
        "cancelled_by" uuid,
        "cancellation_reason" text,
        CONSTRAINT "PK_training_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_training_jobs_model" FOREIGN KEY ("model_id") REFERENCES "ml_models"("id") ON DELETE CASCADE
      );
    `);

    // Create predictions table
    await queryRunner.query(`
      CREATE TABLE "predictions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "model_id" uuid NOT NULL,
        "product_id" uuid,
        "category_id" uuid,
        "location_id" character varying(100),
        "prediction_type" "prediction_type_enum" NOT NULL,
        "status" "prediction_status_enum" NOT NULL DEFAULT 'pending',
        "prediction_date" TIMESTAMP NOT NULL DEFAULT now(),
        "target_date" date NOT NULL,
        "predicted_value" decimal(15,4) NOT NULL,
        "lower_bound" decimal(15,4),
        "upper_bound" decimal(15,4),
        "confidence" decimal(5,4) NOT NULL,
        "confidence_level" "confidence_level_enum" NOT NULL,
        "actual_value" decimal(15,4),
        "error_rate" decimal(15,4),
        "prediction_data" jsonb NOT NULL,
        "input_features" jsonb,
        "metadata" jsonb,
        "forecast_horizon_days" integer NOT NULL DEFAULT 30,
        "is_outlier" boolean NOT NULL DEFAULT false,
        "outlier_reason" text,
        "is_actualized" boolean NOT NULL DEFAULT false,
        "actualized_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        "actionable_insights" jsonb,
        "business_impact" jsonb,
        "prediction_job_id" character varying(255),
        CONSTRAINT "PK_predictions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_predictions_model" FOREIGN KEY ("model_id") REFERENCES "ml_models"("id") ON DELETE CASCADE
      );
    `);

    // Create indexes for ml_models table
    await queryRunner.query(`
      CREATE INDEX "IDX_ml_models_tenant_model_type" ON "ml_models" ("tenant_id", "model_type");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ml_models_tenant_status" ON "ml_models" ("tenant_id", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ml_models_tenant_product_id" ON "ml_models" ("tenant_id", "product_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ml_models_tenant_is_active" ON "ml_models" ("tenant_id", "is_active");
    `);

    // Create indexes for training_jobs table
    await queryRunner.query(`
      CREATE INDEX "IDX_training_jobs_tenant_status" ON "training_jobs" ("tenant_id", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_training_jobs_tenant_model_id" ON "training_jobs" ("tenant_id", "model_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_training_jobs_tenant_job_type" ON "training_jobs" ("tenant_id", "job_type");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_training_jobs_tenant_created_at" ON "training_jobs" ("tenant_id", "created_at");
    `);

    // Create indexes for predictions table
    await queryRunner.query(`
      CREATE INDEX "IDX_predictions_tenant_model_id" ON "predictions" ("tenant_id", "model_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_predictions_tenant_product_id" ON "predictions" ("tenant_id", "product_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_predictions_tenant_prediction_type" ON "predictions" ("tenant_id", "prediction_type");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_predictions_tenant_status" ON "predictions" ("tenant_id", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_predictions_tenant_prediction_date" ON "predictions" ("tenant_id", "prediction_date");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_predictions_tenant_target_date" ON "predictions" ("tenant_id", "target_date");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "predictions"`);
    await queryRunner.query(`DROP TABLE "training_jobs"`);
    await queryRunner.query(`DROP TABLE "ml_models"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "confidence_level_enum"`);
    await queryRunner.query(`DROP TYPE "prediction_status_enum"`);
    await queryRunner.query(`DROP TYPE "prediction_type_enum"`);
    await queryRunner.query(`DROP TYPE "training_job_status_enum"`);
    await queryRunner.query(`DROP TYPE "training_job_type_enum"`);
    await queryRunner.query(`DROP TYPE "forecast_horizon_enum"`);
    await queryRunner.query(`DROP TYPE "model_status_enum"`);
    await queryRunner.query(`DROP TYPE "model_type_enum"`);
  }
}
