import { Injectable, Logger } from '@nestjs/common';
import { PythonShell } from 'python-shell';
import * as path from 'path';
import * as fs from 'fs';
import { MLModel, ModelType } from '../entities/ml-model.entity';
import { Prediction, PredictionType } from '../entities/prediction.entity';
import { PredictionResult } from './model-serving.service';
import { EnhancedMLFallbackService } from './enhanced-ml-fallback.service';
import { IndonesianBusinessCalendarService } from './indonesian-business-calendar.service';

export interface RealMLForecastRequest {
  data_points: number[];
  dates?: string[];
  forecast_steps: number;
  confidence_level?: number;
  seasonal?: boolean;
  seasonal_period?: number;
}

export interface RealMLForecastResult {
  success: boolean;
  model_type: string;
  data_quality?: {
    data_points: number;
    stationarity: {
      is_stationary: boolean;
      p_value: number;
      interpretation: string;
    };
    seasonal_analysis?: any;
  };
  model_diagnostics?: {
    success: boolean;
    order: number[];
    aic: number;
    bic: number;
    mape: number;
  };
  forecasts?: {
    success: boolean;
    forecasts: Array<{
      step: number;
      forecast: number;
      lower_bound: number;
      upper_bound: number;
      confidence_level: number;
    }>;
    forecast_horizon: number;
  };
  error?: string;
  recommendations?: string[];
}

@Injectable()
export class RealMLService {
  private readonly logger = new Logger(RealMLService.name);
  private readonly pythonScriptPath: string;
  private readonly prophetScriptPath: string;
  private readonly xgboostScriptPath: string;
  private readonly enhancedFallbackService: EnhancedMLFallbackService;

  constructor(
    private readonly indonesianBusinessCalendarService: IndonesianBusinessCalendarService
  ) {
    this.pythonScriptPath = path.join(
      __dirname,
      '..',
      'python',
      'arima_service.py'
    );
    this.prophetScriptPath = path.join(
      __dirname,
      '..',
      'python',
      'prophet_service.py'
    );
    this.xgboostScriptPath = path.join(
      __dirname,
      '..',
      'python',
      'xgboost_service.py'
    );
    
    // Initialize enhanced fallback service
    this.enhancedFallbackService = new EnhancedMLFallbackService(
      this.indonesianBusinessCalendarService
    );
  }

  /**
   * Real ARIMA prediction replacing the stub implementation
   * This implements actual statistical ARIMA modeling instead of placeholder
   */
  async predictRealARIMA(
    historicalData: number[],
    forecastDays: number = 30,
    dates?: string[]
  ): Promise<PredictionResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Starting real ARIMA prediction for ${historicalData.length} data points, ${forecastDays} days forecast`
      );

      // Validate input data
      if (!historicalData || historicalData.length < 10) {
        return this.createDataInsufficientResponse(historicalData.length);
      }

      // Prepare request for Python ARIMA service
      const arimaRequest: RealMLForecastRequest = {
        data_points: historicalData,
        dates: dates,
        forecast_steps: forecastDays,
        confidence_level: 0.95,
        seasonal: forecastDays >= 7, // Enable seasonal analysis for longer forecasts
        seasonal_period: 7 // Weekly seasonality for Indonesian business
      };

      // Call real Python ARIMA implementation
      const arimaResult = await this.callPythonARIMA(arimaRequest);

      if (!arimaResult.success) {
        this.logger.warn(`ARIMA prediction failed: ${arimaResult.error}`);
        return this.enhancedFallbackService.createEnhancedARIMAFallback(
          historicalData,
          forecastDays,
          arimaResult.error
        );
      }

      // Extract forecast values
      const forecasts = arimaResult.forecasts?.forecasts || [];
      const primaryForecast = forecasts.length > 0 ? forecasts[0].forecast : 0;

      // Generate time series for response
      const timeSeries = forecasts.map((forecast, index) => ({
        date: this.generateForecastDate(index + 1),
        value: Math.max(0, forecast.forecast),
        lowerBound: Math.max(0, forecast.lower_bound),
        upperBound: Math.max(0, forecast.upper_bound)
      }));

      // Calculate confidence based on model diagnostics
      const confidence = this.calculateRealConfidence(arimaResult);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        predictedValue: Math.max(0, primaryForecast),
        confidence,
        lowerBound: forecasts[0]?.lower_bound || 0,
        upperBound: forecasts[0]?.upper_bound || primaryForecast * 1.2,
        timeSeries,
        actionableInsights: {
          recommendations: this.generateARIMARecommendations(arimaResult),
          alerts: this.generateARIMAAlerts(arimaResult, confidence)
        }
      };

    } catch (error) {
      this.logger.error(
        `Real ARIMA prediction failed: ${error.message}`,
        error.stack
      );

      return this.enhancedFallbackService.createEnhancedARIMAFallback(
        historicalData,
        forecastDays,
        error.message
      );
    }
  }

  /**
   * Call Python ARIMA service with real statistical implementation
   */
  private async callPythonARIMA(
    request: RealMLForecastRequest
  ): Promise<RealMLForecastResult> {
    return new Promise((resolve, reject) => {
      try {
        // Check if Python script exists
        if (!fs.existsSync(this.pythonScriptPath)) {
          throw new Error(`Python ARIMA script not found: ${this.pythonScriptPath}`);
        }

        const options = {
          mode: 'json' as const,
          pythonPath: 'python3',
          pythonOptions: ['-u'],
          scriptPath: path.dirname(this.pythonScriptPath),
          args: []
        };

        const pythonShell = new PythonShell('arima_service.py', options);

        // Send input data
        pythonShell.send(JSON.stringify(request));

        let result: RealMLForecastResult;

        pythonShell.on('message', (message: any) => {
          result = message;
        });

        pythonShell.end((err) => {
          if (err) {
            this.logger.error(`Python ARIMA service error: ${err.message}`);
            resolve({
              success: false,
              model_type: 'ARIMA_ERROR',
              error: `Python service error: ${err.message}`,
              recommendations: [
                'Check Python dependencies installation',
                'Verify data format and quality',
                'Use fallback forecasting method'
              ]
            });
          } else {
            resolve(result || {
              success: false,
              model_type: 'ARIMA_NO_RESULT',
              error: 'No result from Python service'
            });
          }
        });

      } catch (error) {
        this.logger.error(`Python shell setup error: ${error.message}`);
        resolve({
          success: false,
          model_type: 'ARIMA_SETUP_ERROR',
          error: error.message,
          recommendations: [
            'Install python-shell dependency',
            'Configure Python environment',
            'Check system Python installation'
          ]
        });
      }
    });
  }

  /**
   * Calculate confidence based on real model diagnostics
   */
  private calculateRealConfidence(arimaResult: RealMLForecastResult): number {
    try {
      const diagnostics = arimaResult.model_diagnostics;
      const dataQuality = arimaResult.data_quality;

      if (!diagnostics || !dataQuality) {
        return 0.5; // Medium confidence for missing diagnostics
      }

      let confidence = 0.8; // Base confidence

      // Adjust based on MAPE (Mean Absolute Percentage Error)
      if (diagnostics.mape) {
        if (diagnostics.mape < 10) confidence += 0.15;
        else if (diagnostics.mape < 20) confidence += 0.05;
        else if (diagnostics.mape > 50) confidence -= 0.3;
        else if (diagnostics.mape > 30) confidence -= 0.1;
      }

      // Adjust based on data stationarity
      if (dataQuality.stationarity?.is_stationary) {
        confidence += 0.1;
      } else {
        confidence -= 0.05;
      }

      // Adjust based on data quantity
      const dataPoints = dataQuality.data_points || 0;
      if (dataPoints > 100) confidence += 0.1;
      else if (dataPoints < 30) confidence -= 0.2;

      // Ensure confidence is within bounds
      return Math.max(0.1, Math.min(0.95, confidence));

    } catch (error) {
      this.logger.warn(`Confidence calculation error: ${error.message}`);
      return 0.6; // Default confidence
    }
  }

  /**
   * Generate actionable recommendations based on ARIMA results
   */
  private generateARIMARecommendations(arimaResult: RealMLForecastResult): string[] {
    const recommendations: string[] = [];

    // Model-specific recommendations
    if (arimaResult.model_diagnostics?.mape) {
      const mape = arimaResult.model_diagnostics.mape;
      if (mape < 10) {
        recommendations.push('Model prediksi sangat akurat - gunakan untuk perencanaan strategis');
      } else if (mape < 20) {
        recommendations.push('Model prediksi cukup akurat - pantau performa secara berkala');
      } else if (mape > 30) {
        recommendations.push('Akurasi model rendah - pertimbangkan pengumpulan data tambahan');
      }
    }

    // Data quality recommendations
    const dataPoints = arimaResult.data_quality?.data_points || 0;
    if (dataPoints < 30) {
      recommendations.push('Tingkatkan frekuensi pencatatan data untuk prediksi yang lebih akurat');
    }

    // Stationarity recommendations
    if (arimaResult.data_quality?.stationarity && !arimaResult.data_quality.stationarity.is_stationary) {
      recommendations.push('Data menunjukkan tren - pertimbangkan faktor musiman dalam perencanaan');
    }

    // Seasonal recommendations
    if (arimaResult.data_quality?.seasonal_analysis) {
      recommendations.push('Pola musiman terdeteksi - sesuaikan strategi stok dengan musim bisnis');
    }

    // Default recommendations for Indonesian SMBs
    recommendations.push('Lakukan review prediksi setiap minggu untuk akurasi optimal');
    recommendations.push('Gunakan prediksi ini sebagai panduan, bukan keputusan mutlak');

    return recommendations;
  }

  /**
   * Generate alerts based on ARIMA analysis
   */
  private generateARIMAAlerts(
    arimaResult: RealMLForecastResult,
    confidence: number
  ): Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> {
    const alerts: Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> = [];

    // Low confidence alert
    if (confidence < 0.6) {
      alerts.push({
        type: 'low_confidence',
        severity: 'medium',
        message: `Tingkat kepercayaan prediksi rendah (${Math.round(confidence * 100)}%). Gunakan dengan hati-hati.`
      });
    }

    // High error rate alert
    if (arimaResult.model_diagnostics?.mape && arimaResult.model_diagnostics.mape > 30) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'high',
        message: `Tingkat error model tinggi (${Math.round(arimaResult.model_diagnostics.mape)}%). Pertimbangkan pengumpulan data berkualitas lebih baik.`
      });
    }

    // Insufficient data alert
    const dataPoints = arimaResult.data_quality?.data_points || 0;
    if (dataPoints < 20) {
      alerts.push({
        type: 'insufficient_data',
        severity: 'medium',
        message: `Data historis terbatas (${dataPoints} data points). Tambah data untuk prediksi lebih akurat.`
      });
    }

    // Model diagnostics alerts
    if (!arimaResult.model_diagnostics?.success) {
      alerts.push({
        type: 'model_fitting_issue',
        severity: 'high',
        message: 'Model ARIMA mengalami kesulitan dalam fitting data. Periksa kualitas data input.'
      });
    }

    return alerts;
  }

  /**
   * Create response for insufficient data scenarios
   */
  private createDataInsufficientResponse(dataLength: number, modelType: string = 'ARIMA'): PredictionResult {
    return {
      success: false,
      error: `Data tidak mencukupi untuk prediksi ${modelType} (${dataLength} data points, minimum 10 diperlukan)`,
      actionableInsights: {
        recommendations: [
          'Kumpulkan minimal 10 data penjualan historis',
          'Pastikan data tercatat secara konsisten',
          'Gunakan metode prediksi sederhana untuk sementara'
        ],
        alerts: [
          {
            type: 'insufficient_data',
            severity: 'critical',
            message: `Hanya ${dataLength} data points tersedia. ${modelType} memerlukan minimal 10 data points untuk prediksi yang valid.`
          }
        ]
      }
    };
  }

  /**
   * Create fallback response when ML model fails
   */
  private createFallbackResponse(forecastDays: number, error?: string, modelType: string = 'ARIMA'): PredictionResult {
    // Simple linear trend as fallback
    const fallbackValue = 10; // Conservative estimate

    return {
      success: true,
      predictedValue: fallbackValue,
      confidence: 0.3, // Low confidence for fallback
      lowerBound: fallbackValue * 0.7,
      upperBound: fallbackValue * 1.3,
      actionableInsights: {
        recommendations: [
          `Model ${modelType} tidak berhasil - menggunakan estimasi konservatif`,
          'Periksa kualitas data historis',
          'Pertimbangkan konsultasi dengan tim teknis'
        ],
        alerts: [
          {
            type: `${modelType.toLowerCase()}_fallback`,
            severity: 'medium',
            message: `Prediksi ${modelType} gagal${error ? `: ${error}` : ''}. Menggunakan estimasi konservatif.`
          }
        ]
      }
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: any, forecastDays: number, modelType: string = 'ARIMA'): PredictionResult {
    return {
      success: false,
      error: `Prediksi ${modelType} gagal: ${error.message}`,
      actionableInsights: {
        recommendations: [
          'Periksa koneksi sistem prediksi',
          'Verifikasi format data input',
          'Gunakan metode prediksi alternatif'
        ],
        alerts: [
          {
            type: 'system_error',
            severity: 'high',
            message: 'Sistem prediksi mengalami masalah teknis. Hubungi administrator sistem.'
          }
        ]
      }
    };
  }

  /**
   * Generate forecast date for time series
   */
  private generateForecastDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }

  /**
   * Real Prophet prediction for seasonal forecasting
   * Implements Facebook Prophet with Indonesian business context
   */
  async predictRealProphet(
    historicalData: number[],
    forecastDays: number = 30,
    dates?: string[],
    seasonalityConfig?: any
  ): Promise<PredictionResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Starting real Prophet prediction for ${historicalData.length} data points, ${forecastDays} days forecast`
      );

      // Validate input data
      if (!historicalData || historicalData.length < 10) {
        return this.createDataInsufficientResponse(historicalData.length, 'Prophet');
      }

      // Prepare request for Python Prophet service
      const prophetRequest = {
        data_points: historicalData,
        dates: dates,
        forecast_steps: forecastDays,
        include_trend_analysis: true,
        seasonality_config: seasonalityConfig || {
          yearly_seasonality: true,
          weekly_seasonality: true,
          daily_seasonality: false,
          seasonality_mode: 'multiplicative',
          growth: 'linear'
        }
      };

      // Call real Python Prophet implementation
      const prophetResult = await this.callPythonProphet(prophetRequest);

      if (!prophetResult.success) {
        this.logger.warn(`Prophet prediction failed: ${prophetResult.error}`);
        return this.enhancedFallbackService.createEnhancedProphetFallback(
          historicalData,
          forecastDays,
          dates,
          prophetResult.error
        );
      }

      // Extract forecast values
      const forecasts = prophetResult.forecasts?.forecasts || [];
      const primaryForecast = forecasts.length > 0 ? forecasts[0].forecast : 0;

      // Generate time series for response
      const timeSeries = forecasts.map((forecast) => ({
        date: forecast.date,
        value: Math.max(0, forecast.forecast),
        lowerBound: Math.max(0, forecast.lower_bound),
        upperBound: Math.max(0, forecast.upper_bound),
        trend: forecast.trend,
        seasonal: forecast.seasonal
      }));

      // Calculate confidence based on model diagnostics
      const confidence = this.calculateProphetConfidence(prophetResult);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        predictedValue: Math.max(0, primaryForecast),
        confidence,
        lowerBound: forecasts[0]?.lower_bound || 0,
        upperBound: forecasts[0]?.upper_bound || primaryForecast * 1.2,
        timeSeries,
        actionableInsights: {
          recommendations: this.generateProphetRecommendations(prophetResult),
          alerts: this.generateProphetAlerts(prophetResult, confidence)
        }
      };

    } catch (error) {
      this.logger.error(
        `Real Prophet prediction failed: ${error.message}`,
        error.stack
      );

      return this.enhancedFallbackService.createEnhancedProphetFallback(
        historicalData,
        forecastDays,
        dates,
        error.message
      );
    }
  }

  /**
   * Call Python Prophet service with seasonal forecasting
   */
  private async callPythonProphet(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Check if Python script exists
        if (!fs.existsSync(this.prophetScriptPath)) {
          throw new Error(`Python Prophet script not found: ${this.prophetScriptPath}`);
        }

        const options = {
          mode: 'json' as const,
          pythonPath: 'python3',
          pythonOptions: ['-u'],
          scriptPath: path.dirname(this.prophetScriptPath),
          args: []
        };

        const pythonShell = new PythonShell('prophet_service.py', options);

        // Send input data
        pythonShell.send(JSON.stringify(request));

        let result: any;

        pythonShell.on('message', (message: any) => {
          result = message;
        });

        pythonShell.end((err) => {
          if (err) {
            this.logger.error(`Python Prophet service error: ${err.message}`);
            resolve({
              success: false,
              model_type: 'Prophet_ERROR',
              error: `Python service error: ${err.message}`,
              recommendations: [
                'Check Prophet dependencies installation',
                'Verify data format and quality',
                'Use ARIMA fallback forecasting method'
              ]
            });
          } else {
            resolve(result || {
              success: false,
              model_type: 'Prophet_NO_RESULT',
              error: 'No result from Python Prophet service'
            });
          }
        });

      } catch (error) {
        this.logger.error(`Python Prophet shell setup error: ${error.message}`);
        resolve({
          success: false,
          model_type: 'Prophet_SETUP_ERROR',
          error: error.message,
          recommendations: [
            'Install python-shell dependency',
            'Configure Python environment',
            'Check Prophet package installation'
          ]
        });
      }
    });
  }

  /**
   * Calculate confidence based on Prophet model diagnostics
   */
  private calculateProphetConfidence(prophetResult: any): number {
    try {
      const diagnostics = prophetResult.model_diagnostics?.diagnostics;
      
      if (!diagnostics) {
        return 0.6; // Medium confidence for missing diagnostics
      }

      let confidence = 0.8; // Base confidence for Prophet

      // Adjust based on MAPE (Mean Absolute Percentage Error)
      if (diagnostics.mape !== undefined) {
        if (diagnostics.mape < 15) confidence += 0.15;
        else if (diagnostics.mape < 25) confidence += 0.05;
        else if (diagnostics.mape > 50) confidence -= 0.3;
        else if (diagnostics.mape > 35) confidence -= 0.1;
      }

      // Adjust based on cross-validation availability
      if (diagnostics.cross_validation) {
        confidence += 0.1;
        
        // Coverage adjustment
        if (diagnostics.coverage && diagnostics.coverage > 0.8) {
          confidence += 0.05;
        }
      }

      // Adjust based on data quantity
      const dataPoints = prophetResult.data_quality?.data_points || 0;
      if (dataPoints > 100) confidence += 0.1;
      else if (dataPoints < 30) confidence -= 0.15;

      // Ensure confidence is within bounds
      return Math.max(0.1, Math.min(0.95, confidence));

    } catch (error) {
      this.logger.warn(`Prophet confidence calculation error: ${error.message}`);
      return 0.65; // Default confidence for Prophet
    }
  }

  /**
   * Generate actionable recommendations based on Prophet results
   */
  private generateProphetRecommendations(prophetResult: any): string[] {
    const recommendations: string[] = [];

    // Model-specific recommendations
    if (prophetResult.model_diagnostics?.diagnostics?.mape) {
      const mape = prophetResult.model_diagnostics.diagnostics.mape;
      if (mape < 15) {
        recommendations.push('Model Prophet sangat akurat untuk prediksi musiman - ideal untuk perencanaan jangka panjang');
      } else if (mape < 25) {
        recommendations.push('Model Prophet cukup akurat - cocok untuk analisis tren dan musiman');
      } else if (mape > 35) {
        recommendations.push('Akurasi Prophet perlu ditingkatkan - periksa pola musiman dalam data');
      }
    }

    // Seasonality recommendations
    if (prophetResult.indonesian_context?.seasonality_patterns) {
      recommendations.push('Pola musiman terdeteksi - manfaatkan untuk optimasi stok bulanan dan tahunan');
      recommendations.push('Pertimbangkan efek Ramadan dan hari raya dalam perencanaan inventory');
    }

    // Trend analysis recommendations
    if (prophetResult.trend_analysis?.changepoints) {
      const changepoints = prophetResult.trend_analysis.total_changepoints;
      if (changepoints > 5) {
        recommendations.push('Banyak perubahan tren terdeteksi - monitor perubahan pasar secara berkala');
      } else if (changepoints === 0) {
        recommendations.push('Tren stabil - gunakan untuk perencanaan strategis jangka panjang');
      }
    }

    // Data quality recommendations
    const dataPoints = prophetResult.data_quality?.data_points || 0;
    if (dataPoints < 30) {
      recommendations.push('Tingkatkan periode pengumpulan data untuk analisis musiman yang lebih akurat');
    }

    // Default recommendations for Indonesian SMBs
    recommendations.push('Gunakan prediksi Prophet untuk perencanaan bulanan dan analisis tren');
    recommendations.push('Kombinasikan dengan ARIMA untuk prediksi jangka pendek yang lebih presisi');

    return recommendations;
  }

  /**
   * Generate alerts based on Prophet analysis
   */
  private generateProphetAlerts(
    prophetResult: any,
    confidence: number
  ): Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> {
    const alerts: Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> = [];

    // Low confidence alert
    if (confidence < 0.6) {
      alerts.push({
        type: 'low_confidence',
        severity: 'medium',
        message: `Tingkat kepercayaan prediksi Prophet rendah (${Math.round(confidence * 100)}%). Perlu data historis lebih lengkap.`
      });
    }

    // High error rate alert
    if (prophetResult.model_diagnostics?.diagnostics?.mape && prophetResult.model_diagnostics.diagnostics.mape > 35) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'high',
        message: `Tingkat error Prophet tinggi (${Math.round(prophetResult.model_diagnostics.diagnostics.mape)}%). Periksa konsistensi pola musiman.`
      });
    }

    // Trend change alerts
    if (prophetResult.trend_analysis?.total_changepoints > 10) {
      alerts.push({
        type: 'multiple_trend_changes',
        severity: 'medium',
        message: `Banyak perubahan tren terdeteksi (${prophetResult.trend_analysis.total_changepoints}). Monitor stabilitas bisnis.`
      });
    }

    // Model fitting issues
    if (!prophetResult.model_diagnostics?.success) {
      alerts.push({
        type: 'model_fitting_issue',
        severity: 'high',
        message: 'Model Prophet mengalami kesulitan dalam analisis pola. Periksa kualitas dan konsistensi data.'
      });
    }

    return alerts;
  }

  /**
   * Real XGBoost prediction for multi-feature ensemble forecasting
   * Implements gradient boosting with comprehensive feature engineering
   */
  async predictRealXGBoost(
    historicalData: number[],
    forecastDays: number = 1,
    dates?: string[],
    externalFeatures?: Record<string, any[]>,
    hyperparameterConfig?: any
  ): Promise<PredictionResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Starting real XGBoost prediction for ${historicalData.length} data points, ${forecastDays} days forecast`
      );

      // Validate input data - XGBoost needs more data for feature engineering
      if (!historicalData || historicalData.length < 15) {
        return this.createDataInsufficientResponse(historicalData.length, 'XGBoost');
      }

      // Prepare request for Python XGBoost service
      const xgboostRequest = {
        data_points: historicalData,
        dates: dates,
        forecast_steps: forecastDays,
        external_features: externalFeatures,
        optimize_hyperparameters: historicalData.length > 30, // Only optimize if enough data
        include_feature_analysis: true,
        hyperparameter_config: hyperparameterConfig
      };

      // Call real Python XGBoost implementation
      const xgboostResult = await this.callPythonXGBoost(xgboostRequest);

      if (!xgboostResult.success) {
        this.logger.warn(`XGBoost prediction failed: ${xgboostResult.error}`);
        return this.enhancedFallbackService.createEnhancedXGBoostFallback(
          historicalData,
          forecastDays,
          xgboostResult.error
        );
      }

      // Extract forecast values
      const forecasts = xgboostResult.forecasts?.forecasts || [];
      const primaryForecast = forecasts.length > 0 ? forecasts[0].forecast : 0;

      // Generate time series for response
      const timeSeries = forecasts.map((forecast) => ({
        date: forecast.step ? this.generateForecastDate(forecast.step) : new Date().toISOString().split('T')[0],
        value: Math.max(0, forecast.forecast),
        lowerBound: Math.max(0, forecast.lower_bound),
        upperBound: Math.max(0, forecast.upper_bound)
      }));

      // Calculate confidence based on model diagnostics
      const confidence = this.calculateXGBoostConfidence(xgboostResult);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        predictedValue: Math.max(0, primaryForecast),
        confidence,
        lowerBound: forecasts[0]?.lower_bound || 0,
        upperBound: forecasts[0]?.upper_bound || primaryForecast * 1.2,
        timeSeries,
        actionableInsights: {
          recommendations: this.generateXGBoostRecommendations(xgboostResult),
          alerts: this.generateXGBoostAlerts(xgboostResult, confidence)
        }
      };

    } catch (error) {
      this.logger.error(
        `Real XGBoost prediction failed: ${error.message}`,
        error.stack
      );

      return this.enhancedFallbackService.createEnhancedXGBoostFallback(
        historicalData,
        forecastDays,
        error.message
      );
    }
  }

  /**
   * Call Python XGBoost service with gradient boosting ensemble
   */
  private async callPythonXGBoost(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Check if Python script exists
        if (!fs.existsSync(this.xgboostScriptPath)) {
          throw new Error(`Python XGBoost script not found: ${this.xgboostScriptPath}`);
        }

        const options = {
          mode: 'json' as const,
          pythonPath: 'python3',
          pythonOptions: ['-u'],
          scriptPath: path.dirname(this.xgboostScriptPath),
          args: []
        };

        const pythonShell = new PythonShell('xgboost_service.py', options);

        // Send input data
        pythonShell.send(JSON.stringify(request));

        let result: any;

        pythonShell.on('message', (message: any) => {
          result = message;
        });

        pythonShell.end((err) => {
          if (err) {
            this.logger.error(`Python XGBoost service error: ${err.message}`);
            resolve({
              success: false,
              model_type: 'XGBoost_ERROR',
              error: `Python service error: ${err.message}`,
              recommendations: [
                'Check XGBoost dependencies installation',
                'Verify scikit-learn and pandas are available',
                'Use ARIMA/Prophet fallback forecasting methods'
              ]
            });
          } else {
            resolve(result || {
              success: false,
              model_type: 'XGBoost_NO_RESULT',
              error: 'No result from Python XGBoost service'
            });
          }
        });

      } catch (error) {
        this.logger.error(`Python XGBoost shell setup error: ${error.message}`);
        resolve({
          success: false,
          model_type: 'XGBoost_SETUP_ERROR',
          error: error.message,
          recommendations: [
            'Install python-shell dependency',
            'Configure Python environment',
            'Check XGBoost package installation'
          ]
        });
      }
    });
  }

  /**
   * Calculate confidence based on XGBoost model diagnostics
   */
  private calculateXGBoostConfidence(xgboostResult: any): number {
    try {
      const diagnostics = xgboostResult.model_diagnostics;
      
      if (!diagnostics || !diagnostics.success) {
        return 0.5; // Medium confidence for missing diagnostics
      }

      let confidence = 0.75; // Base confidence for XGBoost

      // Adjust based on validation MAPE
      const valMape = diagnostics.validation_metrics?.mape;
      if (valMape !== undefined) {
        if (valMape < 10) confidence += 0.2;
        else if (valMape < 20) confidence += 0.1;
        else if (valMape > 40) confidence -= 0.3;
        else if (valMape > 30) confidence -= 0.15;
      }

      // Adjust based on R² score
      const valR2 = diagnostics.validation_metrics?.r2;
      if (valR2 !== undefined) {
        if (valR2 > 0.8) confidence += 0.15;
        else if (valR2 > 0.6) confidence += 0.05;
        else if (valR2 < 0.3) confidence -= 0.2;
      }

      // Check for overfitting
      if (diagnostics.overfitting_check?.is_overfitting) {
        confidence -= 0.1;
      }

      // Adjust based on data quantity and features
      const trainingSize = diagnostics.training_samples || 0;
      const featuresCount = diagnostics.features_count || 0;
      
      if (trainingSize > 100 && featuresCount > 10) confidence += 0.1;
      else if (trainingSize < 30) confidence -= 0.15;

      // Ensure confidence is within bounds
      return Math.max(0.1, Math.min(0.95, confidence));

    } catch (error) {
      this.logger.warn(`XGBoost confidence calculation error: ${error.message}`);
      return 0.6; // Default confidence for XGBoost
    }
  }

  /**
   * Generate actionable recommendations based on XGBoost results
   */
  private generateXGBoostRecommendations(xgboostResult: any): string[] {
    const recommendations: string[] = [];

    // Model performance recommendations
    const valMape = xgboostResult.model_diagnostics?.validation_metrics?.mape;
    if (valMape !== undefined) {
      if (valMape < 15) {
        recommendations.push('Model XGBoost sangat akurat untuk prediksi multi-fitur - gunakan untuk perencanaan strategis');
      } else if (valMape < 25) {
        recommendations.push('Model XGBoost cukup akurat - pantau performa secara berkala');
      } else if (valMape > 35) {
        recommendations.push('Akurasi XGBoost perlu ditingkatkan - tambah fitur external atau data historis');
      }
    }

    // Feature importance insights
    if (xgboostResult.feature_analysis?.top_features) {
      const topFeatures = xgboostResult.feature_analysis.top_features.slice(0, 3);
      const featureNames = topFeatures.map((f: any) => f[0]).join(', ');
      recommendations.push(`Fitur terpenting: ${featureNames} - fokus pada kualitas data ini`);
    }

    // Data quality recommendations
    const trainingSize = xgboostResult.model_diagnostics?.training_samples || 0;
    if (trainingSize < 50) {
      recommendations.push('Tambah data historis untuk meningkatkan akurasi prediksi XGBoost');
    }

    // Feature engineering recommendations
    const featuresCount = xgboostResult.model_diagnostics?.features_count || 0;
    if (featuresCount > 20) {
      recommendations.push('XGBoost memanfaatkan banyak fitur - pertahankan konsistensi data input');
    }

    // Overfitting warnings
    if (xgboostResult.model_diagnostics?.overfitting_check?.is_overfitting) {
      recommendations.push('Model menunjukkan overfitting - kurangi kompleksitas atau tambah data validasi');
    }

    // Ensemble recommendations
    recommendations.push('Kombinasikan XGBoost dengan ARIMA untuk prediksi yang lebih robust');
    recommendations.push('Gunakan XGBoost untuk analisis fitur bisnis dan faktor-faktor yang mempengaruhi penjualan');

    return recommendations;
  }

  /**
   * Generate alerts based on XGBoost analysis
   */
  private generateXGBoostAlerts(
    xgboostResult: any,
    confidence: number
  ): Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> {
    const alerts: Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> = [];

    // Low confidence alert
    if (confidence < 0.6) {
      alerts.push({
        type: 'low_confidence',
        severity: 'medium',
        message: `Tingkat kepercayaan prediksi XGBoost rendah (${Math.round(confidence * 100)}%). Periksa kualitas fitur input.`
      });
    }

    // High error rate alert
    const valMape = xgboostResult.model_diagnostics?.validation_metrics?.mape;
    if (valMape && valMape > 30) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'high',
        message: `Tingkat error XGBoost tinggi (${Math.round(valMape)}%). Tambah fitur eksternal atau perbaiki kualitas data.`
      });
    }

    // Overfitting alert
    if (xgboostResult.model_diagnostics?.overfitting_check?.is_overfitting) {
      alerts.push({
        type: 'overfitting_detected',
        severity: 'medium',
        message: 'XGBoost menunjukkan overfitting. Model mungkin terlalu kompleks untuk data yang tersedia.'
      });
    }

    // Insufficient data alert
    const trainingSize = xgboostResult.model_diagnostics?.training_samples || 0;
    if (trainingSize < 30) {
      alerts.push({
        type: 'insufficient_training_data',
        severity: 'medium',
        message: `Data training terbatas (${trainingSize} samples). XGBoost memerlukan lebih banyak data untuk performa optimal.`
      });
    }

    // Model fitting issues
    if (!xgboostResult.model_diagnostics?.success) {
      alerts.push({
        type: 'model_fitting_issue',
        severity: 'high',
        message: 'Model XGBoost mengalami kesulitan dalam fitting data. Periksa format dan kualitas data input.'
      });
    }

    return alerts;
  }

  /**
   * Health check for Python ML services
   */
  async checkMLServiceHealth(): Promise<{ status: string; pythonAvailable: boolean; scriptsAvailable: boolean; prophetAvailable: boolean; xgboostAvailable: boolean }> {
    try {
      const pythonAvailable = await this.checkPythonAvailability();
      const arimaScriptAvailable = fs.existsSync(this.pythonScriptPath);
      const prophetScriptAvailable = fs.existsSync(this.prophetScriptPath);
      const xgboostScriptAvailable = fs.existsSync(this.xgboostScriptPath);

      return {
        status: pythonAvailable && arimaScriptAvailable && prophetScriptAvailable && xgboostScriptAvailable ? 'healthy' : 'degraded',
        pythonAvailable,
        scriptsAvailable: arimaScriptAvailable,
        prophetAvailable: prophetScriptAvailable,
        xgboostAvailable: xgboostScriptAvailable
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        pythonAvailable: false,
        scriptsAvailable: false,
        prophetAvailable: false,
        xgboostAvailable: false
      };
    }
  }

  /**
   * Check Python availability
   */
  private async checkPythonAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const pythonShell = new PythonShell(null, {
          pythonPath: 'python3',
          pythonOptions: ['-c', 'print("ok")']
        });

        pythonShell.end((err) => {
          resolve(!err);
        });
      } catch {
        resolve(false);
      }
    });
  }
}