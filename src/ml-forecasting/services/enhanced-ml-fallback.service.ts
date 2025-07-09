import { Injectable, Logger } from '@nestjs/common';
import { PredictionResult } from './model-serving.service';
import { IndonesianBusinessCalendarService } from './indonesian-business-calendar.service';
import * as moment from 'moment-timezone';

/**
 * Enhanced ML Fallback Service for Phase 4.1.5.1
 * 
 * Provides intelligent fallback mechanisms when Python ML dependencies
 * are not available, using statistical methods and Indonesian business context
 */

export interface FallbackConfig {
  confidence: number;
  modelType: string;
  useIndonesianContext: boolean;
  seasonalityFactor: number;
  trendFactor: number;
  volatilityFactor: number;
}

@Injectable()
export class EnhancedMLFallbackService {
  private readonly logger = new Logger(EnhancedMLFallbackService.name);
  
  constructor(
    private readonly indonesianBusinessCalendarService: IndonesianBusinessCalendarService
  ) {}

  /**
   * Enhanced ARIMA fallback using statistical methods
   */
  createEnhancedARIMAFallback(
    historicalData: number[],
    forecastDays: number = 30,
    error?: string
  ): PredictionResult {
    const config: FallbackConfig = {
      confidence: 0.65,
      modelType: 'Enhanced_ARIMA_Fallback',
      useIndonesianContext: true,
      seasonalityFactor: 0.15,
      trendFactor: 0.08,
      volatilityFactor: 0.12
    };

    const prediction = this.calculateStatisticalForecast(
      historicalData,
      forecastDays,
      config
    );

    return {
      success: true,
      predictedValue: prediction.value,
      confidence: prediction.confidence,
      lowerBound: prediction.lowerBound,
      upperBound: prediction.upperBound,
      timeSeries: prediction.timeSeries,
      actionableInsights: {
        recommendations: [
          'Prediksi menggunakan metode statistik enhanced sebagai fallback',
          'Instalasi Python ML dependencies disarankan untuk akurasi optimal',
          'Data historis menunjukkan ' + this.getTrendDescription(prediction.trend),
          'Pertimbangkan faktor musiman Indonesia dalam perencanaan stok'
        ],
        alerts: [
          {
            type: 'arima_enhanced_fallback',
            severity: 'info',
            message: `Fallback ARIMA: ${error ? error : 'Python dependencies tidak tersedia'}. Menggunakan metode statistik enhanced.`
          },
          ...this.getIndonesianBusinessAlerts(forecastDays)
        ]
      }
    };
  }

  /**
   * Enhanced Prophet fallback using trend decomposition
   */
  createEnhancedProphetFallback(
    historicalData: number[],
    forecastDays: number = 30,
    dates?: string[],
    error?: string
  ): PredictionResult {
    const config: FallbackConfig = {
      confidence: 0.72,
      modelType: 'Enhanced_Prophet_Fallback',
      useIndonesianContext: true,
      seasonalityFactor: 0.25,
      trendFactor: 0.12,
      volatilityFactor: 0.10
    };

    const prediction = this.calculateSeasonalForecast(
      historicalData,
      forecastDays,
      config,
      dates
    );

    return {
      success: true,
      predictedValue: prediction.value,
      confidence: prediction.confidence,
      lowerBound: prediction.lowerBound,
      upperBound: prediction.upperBound,
      timeSeries: prediction.timeSeries,
      actionableInsights: {
        recommendations: [
          'Prediksi menggunakan decomposition trend/seasonal sebagai fallback',
          'Faktor musiman Indonesia telah dipertimbangkan dalam prediksi',
          'Rekomendasi: ' + this.getSeasonalRecommendation(prediction.seasonal),
          'Instalasi Prophet library disarankan untuk analisis seasonal yang lebih akurat'
        ],
        alerts: [
          {
            type: 'prophet_enhanced_fallback',
            severity: 'info',
            message: `Fallback Prophet: ${error ? error : 'Python dependencies tidak tersedia'}. Menggunakan decomposition analysis.`
          },
          ...this.getIndonesianSeasonalAlerts(forecastDays)
        ]
      }
    };
  }

  /**
   * Enhanced XGBoost fallback using ensemble of simple models
   */
  createEnhancedXGBoostFallback(
    historicalData: number[],
    forecastDays: number = 30,
    error?: string
  ): PredictionResult {
    const config: FallbackConfig = {
      confidence: 0.58,
      modelType: 'Enhanced_XGBoost_Fallback',
      useIndonesianContext: true,
      seasonalityFactor: 0.18,
      trendFactor: 0.15,
      volatilityFactor: 0.20
    };

    const prediction = this.calculateEnsembleForecast(
      historicalData,
      forecastDays,
      config
    );

    return {
      success: true,
      predictedValue: prediction.value,
      confidence: prediction.confidence,
      lowerBound: prediction.lowerBound,
      upperBound: prediction.upperBound,
      timeSeries: prediction.timeSeries,
      actionableInsights: {
        recommendations: [
          'Prediksi menggunakan ensemble sederhana sebagai fallback XGBoost',
          'Kombinasi trend, seasonal, dan volatility analysis telah diterapkan',
          'Akurasi: ' + this.getAccuracyAssessment(prediction.confidence),
          'Instalasi XGBoost library disarankan untuk feature engineering yang lebih advanced'
        ],
        alerts: [
          {
            type: 'xgboost_enhanced_fallback',
            severity: 'info',
            message: `Fallback XGBoost: ${error ? error : 'Python dependencies tidak tersedia'}. Menggunakan ensemble sederhana.`
          },
          ...this.getVolatilityAlerts(prediction.volatility)
        ]
      }
    };
  }

  /**
   * Statistical forecast calculation with Indonesian business context
   */
  private calculateStatisticalForecast(
    historicalData: number[],
    forecastDays: number,
    config: FallbackConfig
  ): any {
    // Basic statistics
    const mean = this.calculateMean(historicalData);
    const trend = this.calculateTrend(historicalData);
    const volatility = this.calculateVolatility(historicalData);
    const seasonal = this.calculateSeasonality(historicalData);

    // Apply Indonesian business context
    const businessMultiplier = this.getIndonesianBusinessMultiplier(forecastDays);
    
    // Base prediction
    const basePrediction = mean + (trend * forecastDays * config.trendFactor);
    const seasonalAdjustment = basePrediction * seasonal * config.seasonalityFactor;
    const businessAdjustment = basePrediction * businessMultiplier * 0.1;
    
    const finalPrediction = Math.max(0, basePrediction + seasonalAdjustment + businessAdjustment);
    
    // Calculate confidence intervals
    const confidenceInterval = volatility * config.volatilityFactor * Math.sqrt(forecastDays);
    
    return {
      value: finalPrediction,
      confidence: Math.max(0.3, Math.min(0.9, config.confidence - (volatility * 0.1))),
      lowerBound: Math.max(0, finalPrediction - confidenceInterval),
      upperBound: finalPrediction + confidenceInterval,
      trend,
      seasonal,
      volatility,
      timeSeries: this.generateTimeSeriesWithIndonesianContext(
        finalPrediction,
        forecastDays,
        trend,
        seasonal,
        confidenceInterval
      )
    };
  }

  /**
   * Seasonal forecast with Indonesian calendar integration
   */
  private calculateSeasonalForecast(
    historicalData: number[],
    forecastDays: number,
    config: FallbackConfig,
    dates?: string[]
  ): any {
    const basicForecast = this.calculateStatisticalForecast(historicalData, forecastDays, config);
    
    // Enhanced seasonal adjustments for Indonesian context
    const seasonalAdjustments = this.getIndonesianSeasonalAdjustments(forecastDays);
    
    const adjustedValue = basicForecast.value * (1 + seasonalAdjustments.ramadan + seasonalAdjustments.monsoon);
    
    return {
      ...basicForecast,
      value: adjustedValue,
      seasonal: seasonalAdjustments,
      timeSeries: this.generateSeasonalTimeSeries(
        adjustedValue,
        forecastDays,
        basicForecast.trend,
        seasonalAdjustments,
        basicForecast.volatility
      )
    };
  }

  /**
   * Ensemble forecast combining multiple simple models
   */
  private calculateEnsembleForecast(
    historicalData: number[],
    forecastDays: number,
    config: FallbackConfig
  ): any {
    // Simple models
    const linearModel = this.calculateLinearModel(historicalData, forecastDays);
    const exponentialModel = this.calculateExponentialModel(historicalData, forecastDays);
    const movingAverageModel = this.calculateMovingAverageModel(historicalData, forecastDays);
    
    // Ensemble weights
    const weights = [0.4, 0.3, 0.3];
    
    const ensembleValue = 
      linearModel.value * weights[0] +
      exponentialModel.value * weights[1] +
      movingAverageModel.value * weights[2];
    
    const ensembleConfidence = 
      linearModel.confidence * weights[0] +
      exponentialModel.confidence * weights[1] +
      movingAverageModel.confidence * weights[2];
    
    // Apply Indonesian business context
    const businessMultiplier = this.getIndonesianBusinessMultiplier(forecastDays);
    const finalValue = ensembleValue * (1 + businessMultiplier * 0.05);
    
    const volatility = this.calculateVolatility(historicalData);
    const confidenceInterval = volatility * config.volatilityFactor * Math.sqrt(forecastDays);
    
    return {
      value: finalValue,
      confidence: Math.max(0.3, Math.min(0.85, ensembleConfidence)),
      lowerBound: Math.max(0, finalValue - confidenceInterval),
      upperBound: finalValue + confidenceInterval,
      volatility,
      timeSeries: this.generateEnsembleTimeSeries(
        finalValue,
        forecastDays,
        volatility,
        confidenceInterval
      )
    };
  }

  /**
   * Statistical calculation methods
   */
  private calculateMean(data: number[]): number {
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  private calculateTrend(data: number[]): number {
    const n = data.length;
    if (n < 2) return 0;
    
    const xMean = (n - 1) / 2;
    const yMean = this.calculateMean(data);
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (data[i] - yMean);
      denominator += (i - xMean) * (i - xMean);
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateVolatility(data: number[]): number {
    const mean = this.calculateMean(data);
    const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
    const variance = this.calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  }

  private calculateSeasonality(data: number[]): number {
    if (data.length < 14) return 0;
    
    // Weekly seasonality approximation
    const weeklyPattern = [];
    for (let i = 0; i < 7; i++) {
      const weeklyValues = [];
      for (let j = i; j < data.length; j += 7) {
        weeklyValues.push(data[j]);
      }
      weeklyPattern.push(this.calculateMean(weeklyValues));
    }
    
    const overallMean = this.calculateMean(data);
    const currentDayOfWeek = new Date().getDay();
    
    return overallMean === 0 ? 0 : (weeklyPattern[currentDayOfWeek] - overallMean) / overallMean;
  }

  /**
   * Indonesian business context methods
   */
  private getIndonesianBusinessMultiplier(forecastDays: number): number {
    const currentDate = new Date();
    let multiplier = 0;
    
    // Check for upcoming Ramadan/Lebaran effects
    for (let i = 0; i < forecastDays; i++) {
      const checkDate = new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000);
      
      if (this.indonesianBusinessCalendarService.isRamadanPeriod(checkDate)) {
        multiplier += 0.25; // 25% increase during Ramadan
      }
      
      if (this.indonesianBusinessCalendarService.isLebaranPeriod(checkDate)) {
        multiplier += 0.5; // 50% increase during Lebaran
      }
      
      if (this.indonesianBusinessCalendarService.isWetSeason(checkDate)) {
        multiplier += 0.1; // 10% increase during wet season
      }
    }
    
    return multiplier / forecastDays; // Average multiplier
  }

  private getIndonesianSeasonalAdjustments(forecastDays: number): any {
    const currentDate = new Date();
    let ramadanEffect = 0;
    let monsoonEffect = 0;
    
    for (let i = 0; i < forecastDays; i++) {
      const checkDate = new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000);
      
      if (this.indonesianBusinessCalendarService.isRamadanPeriod(checkDate)) {
        ramadanEffect += 0.2;
      }
      
      if (this.indonesianBusinessCalendarService.isWetSeason(checkDate)) {
        monsoonEffect += 0.15;
      }
    }
    
    return {
      ramadan: ramadanEffect / forecastDays,
      monsoon: monsoonEffect / forecastDays
    };
  }

  /**
   * Simple model implementations
   */
  private calculateLinearModel(data: number[], forecastDays: number): any {
    const trend = this.calculateTrend(data);
    const lastValue = data[data.length - 1];
    const prediction = lastValue + (trend * forecastDays);
    
    return {
      value: Math.max(0, prediction),
      confidence: 0.6
    };
  }

  private calculateExponentialModel(data: number[], forecastDays: number): any {
    const alpha = 0.3; // Smoothing parameter
    let smoothedValue = data[0];
    
    for (let i = 1; i < data.length; i++) {
      smoothedValue = alpha * data[i] + (1 - alpha) * smoothedValue;
    }
    
    return {
      value: Math.max(0, smoothedValue),
      confidence: 0.55
    };
  }

  private calculateMovingAverageModel(data: number[], forecastDays: number): any {
    const window = Math.min(7, data.length);
    const recentData = data.slice(-window);
    const average = this.calculateMean(recentData);
    
    return {
      value: Math.max(0, average),
      confidence: 0.5
    };
  }

  /**
   * Time series generation methods
   */
  private generateTimeSeriesWithIndonesianContext(
    baseValue: number,
    forecastDays: number,
    trend: number,
    seasonal: number,
    confidenceInterval: number
  ): any[] {
    const timeSeries = [];
    const currentDate = new Date();
    
    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000);
      const trendComponent = trend * i;
      const seasonalComponent = baseValue * seasonal * Math.sin((i * 2 * Math.PI) / 7);
      
      // Indonesian business context adjustments
      const businessMultiplier = this.indonesianBusinessCalendarService.isRamadanPeriod(forecastDate) ? 1.2 : 1.0;
      const lebaranMultiplier = this.indonesianBusinessCalendarService.isLebaranPeriod(forecastDate) ? 1.5 : 1.0;
      
      const adjustedValue = (baseValue + trendComponent + seasonalComponent) * businessMultiplier * lebaranMultiplier;
      
      timeSeries.push({
        date: forecastDate.toISOString().split('T')[0],
        value: Math.max(0, adjustedValue),
        lowerBound: Math.max(0, adjustedValue - confidenceInterval),
        upperBound: adjustedValue + confidenceInterval
      });
    }
    
    return timeSeries;
  }

  private generateSeasonalTimeSeries(
    baseValue: number,
    forecastDays: number,
    trend: number,
    seasonalAdjustments: any,
    volatility: number
  ): any[] {
    const timeSeries = [];
    const currentDate = new Date();
    
    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000);
      const trendComponent = trend * i;
      
      // Apply seasonal adjustments
      const ramadanEffect = seasonalAdjustments.ramadan * baseValue;
      const monsoonEffect = seasonalAdjustments.monsoon * baseValue;
      
      const adjustedValue = baseValue + trendComponent + ramadanEffect + monsoonEffect;
      const confidenceInterval = volatility * Math.sqrt(i);
      
      timeSeries.push({
        date: forecastDate.toISOString().split('T')[0],
        value: Math.max(0, adjustedValue),
        lowerBound: Math.max(0, adjustedValue - confidenceInterval),
        upperBound: adjustedValue + confidenceInterval,
        trend: trendComponent,
        seasonal: ramadanEffect + monsoonEffect
      });
    }
    
    return timeSeries;
  }

  private generateEnsembleTimeSeries(
    baseValue: number,
    forecastDays: number,
    volatility: number,
    confidenceInterval: number
  ): any[] {
    const timeSeries = [];
    const currentDate = new Date();
    
    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000);
      const adjustedInterval = confidenceInterval * Math.sqrt(i);
      
      timeSeries.push({
        date: forecastDate.toISOString().split('T')[0],
        value: Math.max(0, baseValue),
        lowerBound: Math.max(0, baseValue - adjustedInterval),
        upperBound: baseValue + adjustedInterval
      });
    }
    
    return timeSeries;
  }

  /**
   * Alert and recommendation methods
   */
  private getIndonesianBusinessAlerts(forecastDays: number): any[] {
    const alerts = [];
    const currentDate = new Date();
    
    for (let i = 0; i < forecastDays; i++) {
      const checkDate = new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000);
      
      if (this.indonesianBusinessCalendarService.isRamadanPreparationPeriod(checkDate)) {
        alerts.push({
          type: 'ramadan_preparation',
          severity: 'info',
          message: 'Periode persiapan Ramadan terdeteksi dalam forecast - pertimbangkan peningkatan stok'
        });
        break;
      }
      
      if (this.indonesianBusinessCalendarService.isLebaranPreparationPeriod(checkDate)) {
        alerts.push({
          type: 'lebaran_preparation',
          severity: 'high',
          message: 'Periode persiapan Lebaran terdeteksi - antisipasi lonjakan permintaan'
        });
        break;
      }
    }
    
    return alerts;
  }

  private getIndonesianSeasonalAlerts(forecastDays: number): any[] {
    const alerts = [];
    const currentDate = new Date();
    
    for (let i = 0; i < forecastDays; i++) {
      const checkDate = new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000);
      
      if (this.indonesianBusinessCalendarService.isWetSeason(checkDate)) {
        alerts.push({
          type: 'wet_season',
          severity: 'info',
          message: 'Musim hujan terdeteksi - pertimbangkan dampak pada logistik dan permintaan'
        });
        break;
      }
    }
    
    return alerts;
  }

  private getVolatilityAlerts(volatility: number): any[] {
    const alerts = [];
    
    if (volatility > 50) {
      alerts.push({
        type: 'high_volatility',
        severity: 'warning',
        message: 'Volatilitas tinggi terdeteksi - prediksi memiliki ketidakpastian yang lebih besar'
      });
    }
    
    return alerts;
  }

  /**
   * Description methods
   */
  private getTrendDescription(trend: number): string {
    if (trend > 2) return 'tren naik yang kuat';
    if (trend > 0.5) return 'tren naik moderat';
    if (trend > -0.5) return 'tren stabil';
    if (trend > -2) return 'tren turun moderat';
    return 'tren turun yang kuat';
  }

  private getSeasonalRecommendation(seasonal: any): string {
    if (seasonal.ramadan > 0.1) return 'Persiapkan stok ekstra untuk efek Ramadan';
    if (seasonal.monsoon > 0.1) return 'Pertimbangkan dampak musim hujan pada supply chain';
    return 'Pola seasonal normal, tidak ada penyesuaian khusus diperlukan';
  }

  private getAccuracyAssessment(confidence: number): string {
    if (confidence > 0.8) return 'Tinggi - prediksi dapat diandalkan';
    if (confidence > 0.6) return 'Sedang - prediksi cukup akurat';
    if (confidence > 0.4) return 'Rendah - gunakan dengan hati-hati';
    return 'Sangat rendah - pertimbangkan sumber data tambahan';
  }
}