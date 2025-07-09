import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PythonShell, Options as PythonShellOptions } from 'python-shell';
import { execSync } from 'child_process';

// Data Transfer Objects untuk Python communication
export interface MLDataRequest {
  data_points: number[];
  dates: string[];
  forecast_steps: number;
  seasonal?: boolean;
  confidence_level?: number;
  model_config?: any;
  indonesian_context?: IndonesianBusinessContext;
}

export interface IndonesianBusinessContext {
  include_ramadan?: boolean;
  include_lebaran?: boolean;
  include_holidays?: boolean;
  business_type?: 'retail' | 'wholesale' | 'manufacturing' | 'services';
  location?: 'jakarta' | 'surabaya' | 'bandung' | 'medan' | 'other';
}

export interface ARIMAResponse {
  success: boolean;
  forecasts: Array<{
    date: string;
    forecast: number;
    lower_bound?: number;
    upper_bound?: number;
    confidence?: number;
  }>;
  model_info: {
    order: [number, number, number];
    seasonal_order?: [number, number, number, number];
    aic: number;
    bic: number;
    training_samples: number;
  };
  performance: {
    training_time: number;
    prediction_time: number;
    memory_usage?: number;
  };
  indonesian_factors?: {
    ramadan_effect_detected: boolean;
    seasonal_patterns: string[];
    business_cycle_strength: number;
  };
}

export interface ProphetResponse {
  success: boolean;
  forecasts: Array<{
    date: string;
    forecast: number;
    lower_bound: number;
    upper_bound: number;
    trend: number;
    weekly: number;
    yearly: number;
    ramadan_lebaran?: number;
  }>;
  model_info: {
    changepoints: string[];
    trend_flexibility: number;
    seasonality_strength: {
      weekly: number;
      yearly: number;
      ramadan?: number;
    };
    training_samples: number;
  };
  performance: {
    training_time: number;
    prediction_time: number;
    cross_validation_mape?: number;
  };
  indonesian_insights: {
    ramadan_impact_percentage: number;
    lebaran_surge_multiplier: number;
    payday_effect_strength: number;
    weekend_pattern_detected: boolean;
  };
}

export interface XGBoostResponse {
  success: boolean;
  forecasts: Array<{
    date: string;
    forecast: number;
    step: number;
    confidence?: number;
  }>;
  model_info: {
    feature_importance: Record<string, number>;
    cv_mape: number;
    training_samples: number;
    features_used: string[];
  };
  performance: {
    training_time: number;
    prediction_time: number;
    model_size_mb?: number;
  };
  indonesian_features: {
    most_important_holiday: string;
    ramadan_feature_importance: number;
    payday_feature_importance: number;
    weekend_feature_importance: number;
  };
}

@Injectable()
export class PythonBridgeService {
  private readonly logger = new Logger(PythonBridgeService.name);
  private readonly pythonPath: string;
  private readonly scriptsPath: string;

  constructor() {
    // Initialize Python environment with robust validation
    this.pythonPath = this.findPythonExecutable();
    this.scriptsPath = this.resolveScriptsPath();

    // Validate complete Python environment
    this.validatePythonEnvironment();
  }

  /**
   * Find and validate Python executable
   */
  private findPythonExecutable(): string {
    const candidates = [
      process.env.PYTHON_PATH,
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      '/opt/homebrew/bin/python3', // macOS Homebrew
      'python3',
      'python',
    ].filter(Boolean);

    for (const candidate of candidates) {
      try {
        // Test if Python executable exists and is functional
        execSync(`${candidate} --version`, {
          stdio: 'pipe',
          timeout: 5000,
        });
        this.logger.log(`Found Python executable: ${candidate}`);
        return candidate;
      } catch (error) {
        this.logger.warn(`Python candidate failed: ${candidate}`);
      }
    }

    this.logger.error('No working Python executable found');
    return 'python3'; // Fallback
  }

  /**
   * Resolve Python scripts path for both development and production
   */
  private resolveScriptsPath(): string {
    // Try multiple possible paths
    const candidates = [
      path.join(__dirname, '..', 'python'), // Compiled JS path
      path.join(process.cwd(), 'src', 'ml-forecasting', 'python'), // Development path
      path.join(process.cwd(), 'dist', 'ml-forecasting', 'python'), // Production path
      process.env.PYTHON_SCRIPTS_PATH, // Environment override
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        this.logger.log(`Found Python scripts directory: ${candidate}`);
        return candidate;
      }
    }

    this.logger.error(
      'Python scripts directory not found in any candidate path',
    );
    return path.join(__dirname, '..', 'python'); // Fallback
  }

  /**
   * Comprehensive Python environment validation
   */
  private validatePythonEnvironment(): void {
    try {
      // Check if scripts directory exists
      if (!fs.existsSync(this.scriptsPath)) {
        throw new Error(
          `Python scripts directory not found: ${this.scriptsPath}`,
        );
      }

      // Check if required Python scripts exist
      const requiredScripts = [
        'arima_service.py',
        'prophet_service.py',
        'xgboost_service.py',
      ];
      for (const script of requiredScripts) {
        const scriptPath = path.join(this.scriptsPath, script);
        if (!fs.existsSync(scriptPath)) {
          throw new Error(`Required Python script not found: ${scriptPath}`);
        }
      }

      // Test Python executable with basic imports
      this.validatePythonDependencies();

      this.logger.log('Python environment validation successful');
    } catch (error) {
      this.logger.error(
        `Python environment validation failed: ${error.message}`,
      );
      // Don't throw error - allow graceful degradation to simulation
    }
  }

  /**
   * Validate Python ML dependencies are installed
   */
  private validatePythonDependencies(): void {
    try {
      // Fix: Create a temporary Python script file to avoid shell quote conflicts entirely
      const tempScriptPath = path.join(
        os.tmpdir(),
        `python_deps_check_${Date.now()}.py`,
      );
      const testScript = `import sys
try:
    import pandas
    import numpy
    import statsmodels
    import prophet
    import xgboost
    import sklearn
    print("SUCCESS: Core ML dependencies available")
    # Check optional dependencies
    try:
        import pmdarima
        print("INFO: pmdarima available")
    except ImportError:
        print("WARNING: pmdarima not available (optional)")
except ImportError as e:
    print(f"ERROR: Missing dependency - {e}")
    sys.exit(1)`;

      // Write script to temporary file
      fs.writeFileSync(tempScriptPath, testScript, 'utf8');

      try {
        // Execute the temporary Python script with extended PYTHONPATH
        const userSitePackages =
          '/home/rizal/.local/lib/python3.13/site-packages';
        const currentPythonPath = process.env.PYTHONPATH || '';
        const extendedPythonPath =
          userSitePackages + (currentPythonPath ? ':' + currentPythonPath : '');

        const result = execSync(`${this.pythonPath} "${tempScriptPath}"`, {
          encoding: 'utf8',
          timeout: 10000,
          stdio: 'pipe',
          env: {
            ...process.env,
            PYTHONPATH: extendedPythonPath,
          },
        });

        // Clean up temporary file
        fs.unlinkSync(tempScriptPath);

        if (result.includes('SUCCESS')) {
          this.logger.log('Python ML dependencies validation successful');
        } else {
          throw new Error('Python ML dependencies validation failed');
        }
      } catch (execError) {
        // Clean up temporary file in case of error
        if (fs.existsSync(tempScriptPath)) {
          fs.unlinkSync(tempScriptPath);
        }
        throw execError;
      }
    } catch (error) {
      this.logger.error(
        `Python dependencies validation failed: ${error.message}`,
      );
      this.logger.warn('Consider running: pip3 install -r requirements.txt');
    }
  }

  /**
   * Execute ARIMA model prediction using Python statsmodels with robust error handling
   */
  async executeARIMA(data: MLDataRequest): Promise<ARIMAResponse> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Starting ARIMA prediction for ${data.data_points.length} data points`,
      );

      // Validate input data
      this.validateMLData(data);

      // Execute Python script with timeout and proper error handling
      const response = (await this.executePythonScript(
        'arima_service.py',
        data,
        parseInt(process.env.ML_TIMEOUT || '30000', 10),
      )) as ARIMAResponse;

      // Validate response structure
      this.validatePythonResponse(response, 'ARIMA');

      // Add performance metrics
      response.performance.prediction_time = Date.now() - startTime;

      this.logger.log(
        `ARIMA prediction completed in ${response.performance.prediction_time}ms`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `ARIMA execution failed: ${error.message}`,
        error.stack,
      );

      // Return error response
      return {
        success: false,
        forecasts: [],
        model_info: {
          order: [0, 0, 0],
          aic: 0,
          bic: 0,
          training_samples: 0,
        },
        performance: {
          training_time: 0,
          prediction_time: Date.now() - startTime,
        },
        error: error.message,
      } as any;
    }
  }

  /**
   * Execute Prophet model prediction using Facebook Prophet with robust error handling
   */
  async executeProphet(data: MLDataRequest): Promise<ProphetResponse> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Starting Prophet prediction for ${data.data_points.length} data points`,
      );

      // Validate input data
      this.validateMLData(data);

      // Enrich data with Indonesian business context
      const enrichedData = {
        ...data,
        indonesian_context: {
          include_ramadan: true,
          include_lebaran: true,
          include_holidays: true,
          business_type: data.indonesian_context?.business_type || 'retail',
          location: data.indonesian_context?.location || 'jakarta',
          ...data.indonesian_context,
        },
      };

      // Execute Python script with timeout and proper error handling
      const response = (await this.executePythonScript(
        'prophet_service.py',
        enrichedData,
        parseInt(process.env.ML_TIMEOUT || '45000', 10), // Prophet needs more time
      )) as ProphetResponse;

      // Validate response structure
      this.validatePythonResponse(response, 'Prophet');

      // Add performance metrics
      response.performance.prediction_time = Date.now() - startTime;

      this.logger.log(
        `Prophet prediction completed in ${response.performance.prediction_time}ms`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Prophet execution failed: ${error.message}`,
        error.stack,
      );

      // Return error response
      return {
        success: false,
        forecasts: [],
        model_info: {
          changepoints: [],
          trend_flexibility: 0,
          seasonality_strength: { weekly: 0, yearly: 0 },
          training_samples: 0,
        },
        performance: {
          training_time: 0,
          prediction_time: Date.now() - startTime,
        },
        indonesian_insights: {
          ramadan_impact_percentage: 0,
          lebaran_surge_multiplier: 1,
          payday_effect_strength: 0,
          weekend_pattern_detected: false,
        },
        error: error.message,
      } as any;
    }
  }

  /**
   * Execute XGBoost model prediction using gradient boosting with robust error handling
   */
  async executeXGBoost(data: MLDataRequest): Promise<XGBoostResponse> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Starting XGBoost prediction for ${data.data_points.length} data points`,
      );

      // Validate input data
      this.validateMLData(data);

      // Enrich data with Indonesian business features
      const enrichedData = {
        ...data,
        indonesian_context: {
          include_ramadan: true,
          include_lebaran: true,
          include_holidays: true,
          include_payday_effects: true,
          include_weekend_patterns: true,
          business_type: data.indonesian_context?.business_type || 'retail',
          location: data.indonesian_context?.location || 'jakarta',
          ...data.indonesian_context,
        },
      };

      // Execute Python script with timeout and proper error handling
      const response = (await this.executePythonScript(
        'xgboost_service.py',
        enrichedData,
        parseInt(process.env.ML_TIMEOUT || '60000', 10), // XGBoost needs most time
      )) as XGBoostResponse;

      // Validate response structure
      this.validatePythonResponse(response, 'XGBoost');

      // Add performance metrics
      response.performance.prediction_time = Date.now() - startTime;

      this.logger.log(
        `XGBoost prediction completed in ${response.performance.prediction_time}ms`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `XGBoost execution failed: ${error.message}`,
        error.stack,
      );

      // Return error response
      return {
        success: false,
        forecasts: [],
        model_info: {
          feature_importance: {},
          cv_mape: 100,
          training_samples: 0,
          features_used: [],
        },
        performance: {
          training_time: 0,
          prediction_time: Date.now() - startTime,
        },
        indonesian_features: {
          most_important_holiday: 'unknown',
          ramadan_feature_importance: 0,
          payday_feature_importance: 0,
          weekend_feature_importance: 0,
        },
        error: error.message,
      } as any;
    }
  }

  /**
   * Execute multiple models and return ensemble results
   */
  async executeEnsemble(
    data: MLDataRequest,
    modelTypes: ('arima' | 'prophet' | 'xgboost')[] = [
      'arima',
      'prophet',
      'xgboost',
    ],
  ): Promise<{
    success: boolean;
    models: Array<{
      type: string;
      response: ARIMAResponse | ProphetResponse | XGBoostResponse;
      weight: number;
    }>;
    ensemble_forecast: Array<{
      date: string;
      forecast: number;
      confidence: number;
    }>;
    performance: {
      total_time: number;
      models_executed: number;
    };
  }> {
    const startTime = Date.now();
    const modelResults = [];

    try {
      this.logger.log(
        `Starting ensemble prediction with models: ${modelTypes.join(', ')}`,
      );

      // Execute each model
      for (const modelType of modelTypes) {
        try {
          let result;
          switch (modelType) {
            case 'arima':
              result = await this.executeARIMA(data);
              break;
            case 'prophet':
              result = await this.executeProphet(data);
              break;
            case 'xgboost':
              result = await this.executeXGBoost(data);
              break;
          }

          if (result.success) {
            modelResults.push({
              type: modelType,
              response: result,
              weight: this.calculateModelWeight(result, modelType),
            });
          }
        } catch (error) {
          this.logger.warn(
            `Model ${modelType} failed in ensemble: ${error.message}`,
          );
        }
      }

      if (modelResults.length === 0) {
        throw new Error('All models failed in ensemble execution');
      }

      // Calculate ensemble forecast
      const ensembleForecast = this.calculateEnsembleForecast(modelResults);

      this.logger.log(
        `Ensemble prediction completed with ${modelResults.length} models`,
      );

      return {
        success: true,
        models: modelResults,
        ensemble_forecast: ensembleForecast,
        performance: {
          total_time: Date.now() - startTime,
          models_executed: modelResults.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Ensemble execution failed: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        models: modelResults,
        ensemble_forecast: [],
        performance: {
          total_time: Date.now() - startTime,
          models_executed: modelResults.length,
        },
        error: error.message,
      } as any;
    }
  }

  /**
   * Validate ML data input
   */
  private validateMLData(data: MLDataRequest): void {
    if (!data.data_points || !Array.isArray(data.data_points)) {
      throw new Error('data_points must be a non-empty array');
    }

    if (!data.dates || !Array.isArray(data.dates)) {
      throw new Error('dates must be a non-empty array');
    }

    if (data.data_points.length !== data.dates.length) {
      throw new Error('data_points and dates arrays must have the same length');
    }

    if (data.data_points.length < 10) {
      throw new Error('Minimum 10 data points required for ML prediction');
    }

    if (
      !data.forecast_steps ||
      data.forecast_steps < 1 ||
      data.forecast_steps > 365
    ) {
      throw new Error('forecast_steps must be between 1 and 365');
    }

    // Validate data points are numbers
    if (data.data_points.some(point => isNaN(point) || point < 0)) {
      throw new Error('All data_points must be non-negative numbers');
    }

    // Validate dates
    const dateValidation = data.dates.every(date => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    });

    if (!dateValidation) {
      throw new Error('All dates must be valid ISO date strings');
    }
  }

  /**
   * Calculate model weight for ensemble based on performance
   */
  private calculateModelWeight(
    result: ARIMAResponse | ProphetResponse | XGBoostResponse,
    modelType: string,
  ): number {
    // Base weights untuk each model type
    const baseWeights = {
      arima: 0.3, // Good for stationary time series
      prophet: 0.4, // Excellent for seasonality and holidays
      xgboost: 0.3, // Great for complex patterns
    };

    let weight = baseWeights[modelType] || 0.33;

    // Adjust weight based on model performance
    if ('model_info' in result) {
      if ('cv_mape' in result.model_info && result.model_info.cv_mape) {
        // Lower MAPE = higher weight
        const mapeAdjustment = Math.max(
          0.1,
          1 - result.model_info.cv_mape / 100,
        );
        weight *= mapeAdjustment;
      }

      // Consider training time (faster = slightly higher weight)
      if (result.performance.training_time < 5000) {
        // < 5 seconds
        weight *= 1.1;
      }
    }

    return Math.max(0.1, Math.min(1.0, weight)); // Clamp between 0.1 and 1.0
  }

  /**
   * Calculate weighted ensemble forecast
   */
  private calculateEnsembleForecast(
    modelResults: Array<{
      type: string;
      response: ARIMAResponse | ProphetResponse | XGBoostResponse;
      weight: number;
    }>,
  ): Array<{ date: string; forecast: number; confidence: number }> {
    if (modelResults.length === 0) return [];

    // Normalize weights
    const totalWeight = modelResults.reduce(
      (sum, model) => sum + model.weight,
      0,
    );
    const normalizedResults = modelResults.map(model => ({
      ...model,
      weight: model.weight / totalWeight,
    }));

    // Get maximum forecast length
    const maxLength = Math.max(
      ...normalizedResults.map(model => model.response.forecasts.length),
    );

    const ensembleForecast = [];

    for (let i = 0; i < maxLength; i++) {
      let weightedSum = 0;
      let weightSum = 0;
      let confidenceSum = 0;
      let date = '';

      normalizedResults.forEach(model => {
        if (i < model.response.forecasts.length) {
          const forecast = model.response.forecasts[i];
          weightedSum += forecast.forecast * model.weight;
          weightSum += model.weight;

          // Calculate confidence (if available)
          const confidence =
            (forecast as any).confidence ||
            ((forecast as any).lower_bound && (forecast as any).upper_bound
              ? 1 -
                Math.abs(
                  (forecast as any).upper_bound - (forecast as any).lower_bound,
                ) /
                  forecast.forecast
              : 0.8);
          confidenceSum += confidence * model.weight;

          date = forecast.date;
        }
      });

      if (weightSum > 0) {
        ensembleForecast.push({
          date,
          forecast: Math.round(weightedSum / weightSum),
          confidence: Number((confidenceSum / weightSum).toFixed(3)),
        });
      }
    }

    return ensembleForecast;
  }

  /**
   * Execute Python script with robust error handling and timeout management
   */
  private async executePythonScript(
    scriptName: string,
    data: any,
    timeout: number = 30000,
  ): Promise<any> {
    try {
      // Validate script exists
      const scriptPath = path.join(this.scriptsPath, scriptName);
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Python script not found: ${scriptPath}`);
      }

      // Prepare script execution options with extended PYTHONPATH
      const userSitePackages =
        '/home/rizal/.local/lib/python3.13/site-packages';
      const currentPythonPath = process.env.PYTHONPATH || '';
      const extendedPythonPath =
        userSitePackages + (currentPythonPath ? ':' + currentPythonPath : '');

      const options: PythonShellOptions = {
        mode: 'json',
        pythonPath: this.pythonPath,
        pythonOptions: ['-u'], // Unbuffered output
        scriptPath: '',
        args: [JSON.stringify(data)],
        env: {
          ...process.env,
          PYTHONPATH: extendedPythonPath,
        },
      };

      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`Python script timeout after ${timeout}ms`)),
          timeout,
        );
      });

      const executionPromise = PythonShell.run(scriptPath, options);

      const results = (await Promise.race([
        executionPromise,
        timeoutPromise,
      ])) as any[];

      if (!results || results.length === 0) {
        throw new Error(`No results returned from ${scriptName}`);
      }

      return results[0];
    } catch (error) {
      this.logger.error(
        `Python script execution failed: ${scriptName}`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Validate Python response structure and data integrity
   */
  private validatePythonResponse(response: any, modelType: string): void {
    if (!response) {
      throw new Error(`Empty response from ${modelType} model`);
    }

    if (!response.success) {
      throw new Error(
        `${modelType} model execution failed: ${
          response.error || 'Unknown error'
        }`,
      );
    }

    if (!response.forecasts || !Array.isArray(response.forecasts)) {
      throw new Error(`Invalid forecasts format from ${modelType} model`);
    }

    if (response.forecasts.length === 0) {
      throw new Error(`No forecasts generated by ${modelType} model`);
    }

    // Validate each forecast point
    for (const forecast of response.forecasts) {
      if (typeof forecast.forecast !== 'number' || forecast.forecast < 0) {
        throw new Error(`Invalid forecast value in ${modelType} response`);
      }

      if (!forecast.date) {
        throw new Error(`Missing date in ${modelType} forecast`);
      }
    }

    // Validate model info exists
    if (!response.model_info) {
      throw new Error(`Missing model information in ${modelType} response`);
    }

    // Validate performance metrics
    if (!response.performance) {
      throw new Error(`Missing performance metrics in ${modelType} response`);
    }
  }

  /**
   * Health check untuk Python environment
   */
  async checkPythonEnvironment(): Promise<{
    python_available: boolean;
    python_version?: string;
    required_packages: Array<{
      name: string;
      available: boolean;
      version?: string;
    }>;
    scripts_available: Array<{
      name: string;
      path: string;
      exists: boolean;
    }>;
  }> {
    try {
      // Check Python availability
      const pythonCheck = await PythonShell.run('--version', {
        mode: 'text',
        pythonPath: this.pythonPath,
        pythonOptions: [],
        scriptPath: '',
        args: [],
      });

      // Package name to import name mapping to handle pip vs import name differences
      const packageMapping = {
        pandas: 'pandas',
        numpy: 'numpy',
        statsmodels: 'statsmodels',
        prophet: 'prophet',
        xgboost: 'xgboost',
        'scikit-learn': 'sklearn', // Fix: scikit-learn package imports as sklearn
      };

      const packageChecks = [];
      for (const [pipName, importName] of Object.entries(packageMapping)) {
        try {
          const result = await PythonShell.run('-c', {
            mode: 'text',
            pythonPath: this.pythonPath,
            pythonOptions: [],
            scriptPath: '',
            args: [`import ${importName}; print(${importName}.__version__)`],
          });

          packageChecks.push({
            name: pipName,
            available: true,
            version: result[0]?.trim(),
          });
        } catch (error) {
          packageChecks.push({
            name: pipName,
            available: false,
          });
        }
      }

      const scriptChecks = [
        'arima_service.py',
        'prophet_service.py',
        'xgboost_service.py',
      ].map(script => ({
        name: script,
        path: path.join(this.scriptsPath, script),
        exists: fs.existsSync(path.join(this.scriptsPath, script)),
      }));

      return {
        python_available: true,
        python_version: pythonCheck[0],
        required_packages: packageChecks,
        scripts_available: scriptChecks,
      };
    } catch (error) {
      return {
        python_available: false,
        required_packages: [],
        scripts_available: [],
      };
    }
  }
}
