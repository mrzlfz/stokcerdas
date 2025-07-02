import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// ML libraries
import * as regression from 'ml-regression';
import * as stats from 'simple-statistics';
import { Matrix } from 'ml-matrix';

import { MLModel, ModelType, ModelStatus } from '../entities/ml-model.entity';
import { TrainingJob, TrainingJobStatus, TrainingJobType } from '../entities/training-job.entity';
import { DataPipelineService } from './data-pipeline.service';

export interface TrainingRequest {
  modelId?: string; // For retraining existing models
  modelType: ModelType;
  modelName: string;
  productId?: string;
  categoryId?: string;
  locationId?: string;
  trainingConfig: {
    dataSource: {
      from: string;
      to: string;
      productIds?: string[];
      categoryIds?: string[];
      locationIds?: string[];
    };
    hyperparameters: Record<string, any>;
    validation: {
      splitRatio: number;
      method: 'time_series' | 'random';
    };
    features: string[];
    target: string;
  };
  userId?: string;
}

export interface TrainingResult {
  success: boolean;
  modelId: string;
  jobId: string;
  performance?: {
    mae: number;
    mape: number;
    rmse: number;
    r2Score?: number;
  };
  error?: string;
}

@Injectable()
export class ModelTrainingService {
  private readonly logger = new Logger(ModelTrainingService.name);
  private readonly modelStoragePath: string;

  constructor(
    @InjectRepository(MLModel)
    private mlModelRepo: Repository<MLModel>,
    
    @InjectRepository(TrainingJob)
    private trainingJobRepo: Repository<TrainingJob>,
    
    @InjectQueue('ml-training')
    private trainingQueue: Queue,
    
    private dataPipelineService: DataPipelineService,
    private configService: ConfigService,
  ) {
    this.modelStoragePath = this.configService.get('ML_MODEL_STORAGE_PATH', '/tmp/ml-models');
    this.ensureStorageDirectory();
  }

  /**
   * Start training a new model
   */
  async startTraining(
    tenantId: string,
    request: TrainingRequest
  ): Promise<TrainingResult> {
    this.logger.log(`Starting training for model type: ${request.modelType}`);

    try {
      // Create or update ML model record
      let model: MLModel;
      
      if (request.modelId) {
        // Retraining existing model
        model = await this.mlModelRepo.findOne({
          where: { id: request.modelId, tenantId }
        });
        
        if (!model) {
          throw new Error(`Model ${request.modelId} not found`);
        }
        
        model.status = ModelStatus.TRAINING;
        model.hyperparameters = request.trainingConfig.hyperparameters;
        model.trainingConfig = {
          trainingDataFrom: request.trainingConfig.dataSource.from,
          trainingDataTo: request.trainingConfig.dataSource.to,
          validationSplit: request.trainingConfig.validation.splitRatio,
          features: request.trainingConfig.features,
          target: request.trainingConfig.target,
        };
      } else {
        // Creating new model
        model = new MLModel();
        model.tenantId = tenantId;
        model.name = request.modelName;
        model.modelType = request.modelType;
        model.status = ModelStatus.TRAINING;
        model.productId = request.productId;
        model.categoryId = request.categoryId;
        model.locationId = request.locationId;
        model.hyperparameters = request.trainingConfig.hyperparameters;
        model.trainingConfig = {
          trainingDataFrom: request.trainingConfig.dataSource.from,
          trainingDataTo: request.trainingConfig.dataSource.to,
          validationSplit: request.trainingConfig.validation.splitRatio,
          features: request.trainingConfig.features,
          target: request.trainingConfig.target,
        };
        model.createdBy = request.userId;
      }

      model = await this.mlModelRepo.save(model);

      // Create training job
      const trainingJob = new TrainingJob();
      trainingJob.tenantId = tenantId;
      trainingJob.modelId = model.id;
      trainingJob.jobType = request.modelId ? TrainingJobType.RETRAINING : TrainingJobType.INITIAL_TRAINING;
      trainingJob.status = TrainingJobStatus.QUEUED;
      trainingJob.trainingConfig = {
        dataSource: request.trainingConfig.dataSource,
        validation: request.trainingConfig.validation,
        hyperparameters: request.trainingConfig.hyperparameters,
        features: request.trainingConfig.features,
        target: request.trainingConfig.target,
      };
      trainingJob.createdBy = request.userId;

      const savedJob = await this.trainingJobRepo.save(trainingJob);

      // Queue the training job
      const job = await this.trainingQueue.add('train-model', {
        tenantId,
        modelId: model.id,
        jobId: savedJob.id,
        trainingConfig: request.trainingConfig,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      // Update job with queue job ID
      savedJob.jobId = job.id.toString();
      await this.trainingJobRepo.save(savedJob);

      return {
        success: true,
        modelId: model.id,
        jobId: savedJob.id,
      };

    } catch (error) {
      this.logger.error(`Failed to start training: ${error.message}`, error.stack);
      return {
        success: false,
        modelId: '',
        jobId: '',
        error: error.message,
      };
    }
  }

  /**
   * Execute model training (called by queue processor)
   */
  async executeTraining(
    tenantId: string,
    modelId: string,
    jobId: string,
    trainingConfig: any
  ): Promise<void> {
    const job = await this.trainingJobRepo.findOne({
      where: { id: jobId, tenantId }
    });

    if (!job) {
      throw new Error(`Training job ${jobId} not found`);
    }

    const model = await this.mlModelRepo.findOne({
      where: { id: modelId, tenantId }
    });

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    try {
      job.start();
      await this.trainingJobRepo.save(job);

      // Step 1: Data extraction and preprocessing
      job.updateProgress(10, 'Extracting training data');
      await this.trainingJobRepo.save(job);

      const timeSeries = await this.dataPipelineService.extractSalesData(tenantId, {
        dateRange: trainingConfig.dataSource,
        aggregation: 'daily',
        productIds: trainingConfig.dataSource.productIds,
        categoryIds: trainingConfig.dataSource.categoryIds,
        locationIds: trainingConfig.dataSource.locationIds,
        features: trainingConfig.features,
        target: trainingConfig.target,
      });

      if (timeSeries.length === 0) {
        throw new Error('No training data found for the specified criteria');
      }

      job.updateProgress(30, 'Extracting features');
      await this.trainingJobRepo.save(job);

      const productIds = trainingConfig.dataSource.productIds || 
        [...new Set(timeSeries.map(ts => ts.productId))];

      const features = await this.dataPipelineService.extractProductFeatures(
        tenantId, 
        productIds
      );

      job.updateProgress(50, 'Preprocessing data');
      await this.trainingJobRepo.save(job);

      const preprocessedData = await this.dataPipelineService.preprocessData(
        timeSeries,
        features,
        {
          dateRange: trainingConfig.dataSource,
          aggregation: 'daily',
          features: trainingConfig.features,
          target: trainingConfig.target,
        }
      );

      // Step 2: Train/validation split
      const { train, validation } = this.dataPipelineService.createTrainValidationSplit(
        preprocessedData.features,
        preprocessedData.target,
        preprocessedData.dates,
        trainingConfig.validation.splitRatio,
        trainingConfig.validation.method
      );

      job.updateProgress(60, 'Training model');
      await this.trainingJobRepo.save(job);

      // Step 3: Model training based on type
      let trainedModel: any;
      let performance: any;

      switch (model.modelType) {
        case ModelType.LINEAR_REGRESSION:
          ({ model: trainedModel, performance } = await this.trainLinearRegression(
            train,
            validation,
            trainingConfig.hyperparameters
          ));
          break;

        case ModelType.EXPONENTIAL_SMOOTHING:
          ({ model: trainedModel, performance } = await this.trainExponentialSmoothing(
            train,
            validation,
            trainingConfig.hyperparameters
          ));
          break;

        case ModelType.ARIMA:
          ({ model: trainedModel, performance } = await this.trainARIMA(
            train,
            validation,
            trainingConfig.hyperparameters
          ));
          break;

        case ModelType.PROPHET:
          ({ model: trainedModel, performance } = await this.trainProphet(
            train,
            validation,
            trainingConfig.hyperparameters
          ));
          break;

        case ModelType.XGBOOST:
          ({ model: trainedModel, performance } = await this.trainXGBoost(
            train,
            validation,
            trainingConfig.hyperparameters
          ));
          break;

        default:
          throw new Error(`Unsupported model type: ${model.modelType}`);
      }

      job.updateProgress(80, 'Saving model');
      await this.trainingJobRepo.save(job);

      // Step 4: Save trained model
      const modelPath = await this.saveModel(model.id, trainedModel);

      // Step 5: Update model with results
      model.updatePerformance({
        mae: performance.mae,
        mape: performance.mape,
        rmse: performance.rmse,
        r2Score: performance.r2Score,
        trainingDuration: job.duration || 0,
        totalSamples: train.features.length + validation.features.length,
        validationSamples: validation.features.length,
      });

      model.status = ModelStatus.TRAINED;
      model.trainedAt = new Date();
      model.modelPath = modelPath;

      // Auto-deploy if performance is good enough
      if (model.isAccurate) {
        model.deploy();
      }

      await this.mlModelRepo.save(model);

      // Complete training job
      job.complete({
        training: {
          mae: performance.mae,
          mape: performance.mape,
          rmse: performance.rmse,
          r2Score: performance.r2Score,
        },
        validation: {
          mae: performance.mae,
          mape: performance.mape,
          rmse: performance.rmse,
          r2Score: performance.r2Score,
        },
      });

      job.updateProgress(100, 'Training completed');
      await this.trainingJobRepo.save(job);

      this.logger.log(`Model training completed successfully: ${model.id}`);

    } catch (error) {
      this.logger.error(`Training failed for model ${modelId}: ${error.message}`, error.stack);
      
      job.fail(error.message, { type: error.constructor.name, stack: error.stack });
      await this.trainingJobRepo.save(job);
      
      model.status = ModelStatus.FAILED;
      await this.mlModelRepo.save(model);
      
      throw error;
    }
  }

  /**
   * Train Linear Regression model
   */
  private async trainLinearRegression(
    train: any,
    validation: any,
    hyperparameters: any
  ): Promise<{ model: any; performance: any }> {
    this.logger.debug('Training Linear Regression model');

    // Use ml-regression library for linear regression
    const mlr = new regression.MLR(train.features, train.target);
    
    // Make predictions on validation set
    const predictions = validation.features.map((features: number[]) => 
      mlr.predict(features)
    );

    const performance = this.calculatePerformanceMetrics(validation.target, predictions);

    return {
      model: {
        type: 'linear_regression',
        weights: mlr.weights,
        intercept: mlr.intercept,
        features: train.features[0].length,
      },
      performance,
    };
  }

  /**
   * Train Exponential Smoothing model
   */
  private async trainExponentialSmoothing(
    train: any,
    validation: any,
    hyperparameters: any
  ): Promise<{ model: any; performance: any }> {
    this.logger.debug('Training Exponential Smoothing model');

    const alpha = hyperparameters.alpha || 0.3;
    const beta = hyperparameters.beta || 0.1;
    const gamma = hyperparameters.gamma || 0.1;

    // Simple implementation of Holt-Winters exponential smoothing
    const predictions = this.holtWintersSmoothing(
      train.target,
      validation.target.length,
      alpha,
      beta,
      gamma
    );

    const performance = this.calculatePerformanceMetrics(validation.target, predictions);

    return {
      model: {
        type: 'exponential_smoothing',
        alpha,
        beta,
        gamma,
        lastValues: train.target.slice(-12), // Keep last 12 values for future predictions
      },
      performance,
    };
  }

  /**
   * Train ARIMA model using Python
   */
  private async trainARIMA(
    train: any,
    validation: any,
    hyperparameters: any
  ): Promise<{ model: any; performance: any }> {
    this.logger.debug('Training ARIMA model');

    const p = hyperparameters.p || 1;
    const d = hyperparameters.d || 1;
    const q = hyperparameters.q || 1;

    // Create Python script for ARIMA training
    const pythonScript = this.createARIMAPythonScript(train.target, validation.target, p, d, q);
    const scriptPath = path.join(this.modelStoragePath, `arima_${Date.now()}.py`);
    
    fs.writeFileSync(scriptPath, pythonScript);

    try {
      const result = await this.executePythonScript(scriptPath);
      const predictions = JSON.parse(result).predictions;
      
      const performance = this.calculatePerformanceMetrics(validation.target, predictions);

      return {
        model: {
          type: 'arima',
          order: [p, d, q],
          parameters: result.parameters || {},
          lastValues: train.target.slice(-Math.max(p, q + d)), // Keep necessary values
        },
        performance,
      };
    } finally {
      // Cleanup
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
    }
  }

  /**
   * Train Prophet model using Python
   */
  private async trainProphet(
    train: any,
    validation: any,
    hyperparameters: any
  ): Promise<{ model: any; performance: any }> {
    this.logger.debug('Training Prophet model');

    // Create Python script for Prophet training
    const pythonScript = this.createProphetPythonScript(
      train.target,
      train.dates,
      validation.target,
      validation.dates,
      hyperparameters
    );
    
    const scriptPath = path.join(this.modelStoragePath, `prophet_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);

    try {
      const result = await this.executePythonScript(scriptPath);
      const predictions = JSON.parse(result).predictions;
      
      const performance = this.calculatePerformanceMetrics(validation.target, predictions);

      return {
        model: {
          type: 'prophet',
          changepoint_prior_scale: hyperparameters.changepoint_prior_scale || 0.05,
          seasonality_prior_scale: hyperparameters.seasonality_prior_scale || 10,
          holidays_prior_scale: hyperparameters.holidays_prior_scale || 10,
          seasonality: hyperparameters.seasonality || 'auto',
        },
        performance,
      };
    } finally {
      // Cleanup
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
    }
  }

  /**
   * Train XGBoost model using Python
   */
  private async trainXGBoost(
    train: any,
    validation: any,
    hyperparameters: any
  ): Promise<{ model: any; performance: any }> {
    this.logger.debug('Training XGBoost model');

    // Create Python script for XGBoost training
    const pythonScript = this.createXGBoostPythonScript(
      train.features,
      train.target,
      validation.features,
      validation.target,
      hyperparameters
    );
    
    const scriptPath = path.join(this.modelStoragePath, `xgboost_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);

    try {
      const result = await this.executePythonScript(scriptPath);
      const predictions = JSON.parse(result).predictions;
      
      const performance = this.calculatePerformanceMetrics(validation.target, predictions);

      return {
        model: {
          type: 'xgboost',
          n_estimators: hyperparameters.n_estimators || 100,
          max_depth: hyperparameters.max_depth || 6,
          learning_rate: hyperparameters.learning_rate || 0.1,
          feature_importance: JSON.parse(result).feature_importance || {},
        },
        performance,
      };
    } finally {
      // Cleanup
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
    }
  }

  // Helper methods

  private calculatePerformanceMetrics(actual: number[], predicted: number[]): any {
    const n = actual.length;
    
    if (n === 0 || n !== predicted.length) {
      throw new Error('Invalid input for performance calculation');
    }

    // Mean Absolute Error
    const mae = actual.reduce((sum, a, i) => sum + Math.abs(a - predicted[i]), 0) / n;
    
    // Root Mean Square Error
    const rmse = Math.sqrt(
      actual.reduce((sum, a, i) => sum + Math.pow(a - predicted[i], 2), 0) / n
    );
    
    // Mean Absolute Percentage Error
    const mape = actual.reduce((sum, a, i) => {
      if (a === 0) return sum;
      return sum + Math.abs((a - predicted[i]) / a);
    }, 0) / n * 100;
    
    // R-squared
    const actualMean = stats.mean(actual);
    const totalSumSquares = actual.reduce((sum, a) => sum + Math.pow(a - actualMean, 2), 0);
    const residualSumSquares = actual.reduce((sum, a, i) => sum + Math.pow(a - predicted[i], 2), 0);
    const r2Score = totalSumSquares === 0 ? 0 : 1 - (residualSumSquares / totalSumSquares);

    return { mae, rmse, mape, r2Score };
  }

  private holtWintersSmoothing(
    data: number[],
    forecastPeriods: number,
    alpha: number,
    beta: number,
    gamma: number
  ): number[] {
    const seasonLength = 12; // Assuming monthly seasonality
    const n = data.length;
    
    if (n < seasonLength * 2) {
      // Fallback to simple exponential smoothing if not enough data
      return this.simpleExponentialSmoothing(data, forecastPeriods, alpha);
    }

    // Initialize level, trend, and seasonal components
    let level = stats.mean(data.slice(0, seasonLength));
    let trend = (stats.mean(data.slice(seasonLength, seasonLength * 2)) - level) / seasonLength;
    const seasonal = new Array(seasonLength);
    
    for (let i = 0; i < seasonLength; i++) {
      seasonal[i] = data[i] / level;
    }

    const predictions = [];
    
    // Apply Holt-Winters method
    for (let t = seasonLength; t < n; t++) {
      const prevLevel = level;
      const prevTrend = trend;
      
      level = alpha * (data[t] / seasonal[t % seasonLength]) + (1 - alpha) * (prevLevel + prevTrend);
      trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
      seasonal[t % seasonLength] = gamma * (data[t] / level) + (1 - gamma) * seasonal[t % seasonLength];
    }

    // Generate forecasts
    for (let i = 0; i < forecastPeriods; i++) {
      const forecast = (level + (i + 1) * trend) * seasonal[(n + i) % seasonLength];
      predictions.push(Math.max(0, forecast)); // Ensure non-negative predictions
    }

    return predictions;
  }

  private simpleExponentialSmoothing(data: number[], forecastPeriods: number, alpha: number): number[] {
    if (data.length === 0) return [];
    
    let level = data[0];
    
    for (let i = 1; i < data.length; i++) {
      level = alpha * data[i] + (1 - alpha) * level;
    }

    return new Array(forecastPeriods).fill(Math.max(0, level));
  }

  private async saveModel(modelId: string, model: any): Promise<string> {
    const modelPath = path.join(this.modelStoragePath, `${modelId}.json`);
    fs.writeFileSync(modelPath, JSON.stringify(model, null, 2));
    return modelPath;
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.modelStoragePath)) {
      fs.mkdirSync(this.modelStoragePath, { recursive: true });
    }
  }

  private createARIMAPythonScript(trainData: number[], testData: number[], p: number, d: number, q: number): string {
    return `
import json
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
import warnings
warnings.filterwarnings('ignore')

train_data = ${JSON.stringify(trainData)}
test_data = ${JSON.stringify(testData)}

try:
    # Fit ARIMA model
    model = ARIMA(train_data, order=(${p}, ${d}, ${q}))
    fitted_model = model.fit()
    
    # Generate predictions
    predictions = fitted_model.forecast(steps=${testData.length})
    
    result = {
        'predictions': predictions.tolist(),
        'parameters': {
            'aic': fitted_model.aic,
            'bic': fitted_model.bic,
            'params': fitted_model.params.tolist() if hasattr(fitted_model.params, 'tolist') else []
        }
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({'error': str(e), 'predictions': []}))
`;
  }

  private createProphetPythonScript(
    trainData: number[],
    trainDates: string[],
    testData: number[],
    testDates: string[],
    hyperparameters: any
  ): string {
    return `
import json
import pandas as pd
from prophet import Prophet
import warnings
warnings.filterwarnings('ignore')

# Prepare training data
train_df = pd.DataFrame({
    'ds': pd.to_datetime(${JSON.stringify(trainDates)}),
    'y': ${JSON.stringify(trainData)}
})

# Prepare test dates
test_dates = pd.to_datetime(${JSON.stringify(testDates)})

try:
    # Initialize Prophet model
    model = Prophet(
        changepoint_prior_scale=${hyperparameters.changepoint_prior_scale || 0.05},
        seasonality_prior_scale=${hyperparameters.seasonality_prior_scale || 10},
        holidays_prior_scale=${hyperparameters.holidays_prior_scale || 10}
    )
    
    # Fit model
    model.fit(train_df)
    
    # Create future dataframe
    future_df = pd.DataFrame({'ds': test_dates})
    
    # Generate predictions
    forecast = model.predict(future_df)
    predictions = forecast['yhat'].tolist()
    
    result = {
        'predictions': predictions,
        'parameters': {
            'changepoints': len(model.changepoints),
            'seasonalities': list(model.seasonalities.keys())
        }
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({'error': str(e), 'predictions': []}))
`;
  }

  private createXGBoostPythonScript(
    trainFeatures: number[][],
    trainTarget: number[],
    testFeatures: number[][],
    testTarget: number[],
    hyperparameters: any
  ): string {
    return `
import json
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error
import warnings
warnings.filterwarnings('ignore')

# Prepare data
X_train = np.array(${JSON.stringify(trainFeatures)})
y_train = np.array(${JSON.stringify(trainTarget)})
X_test = np.array(${JSON.stringify(testFeatures)})
y_test = np.array(${JSON.stringify(testTarget)})

try:
    # Initialize XGBoost model
    model = xgb.XGBRegressor(
        n_estimators=${hyperparameters.n_estimators || 100},
        max_depth=${hyperparameters.max_depth || 6},
        learning_rate=${hyperparameters.learning_rate || 0.1},
        random_state=42
    )
    
    # Fit model
    model.fit(X_train, y_train)
    
    # Generate predictions
    predictions = model.predict(X_test).tolist()
    
    # Get feature importance
    feature_importance = model.feature_importances_.tolist()
    
    result = {
        'predictions': predictions,
        'feature_importance': feature_importance,
        'parameters': {
            'n_estimators': model.n_estimators,
            'max_depth': model.max_depth,
            'learning_rate': model.learning_rate
        }
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({'error': str(e), 'predictions': []}))
`;
  }

  private executePythonScript(scriptPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [scriptPath]);
      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Python script failed with code ${code}: ${error}`));
        }
      });

      // Set timeout for Python execution
      setTimeout(() => {
        python.kill();
        reject(new Error('Python script execution timeout'));
      }, 300000); // 5 minutes timeout
    });
  }
}