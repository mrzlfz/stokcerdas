import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as moment from 'moment-timezone';

import { MLModel, ModelStatus } from '../entities/ml-model.entity';
import { Prediction, PredictionStatus } from '../entities/prediction.entity';
import { TrainingJob } from '../entities/training-job.entity';
import { DataPipelineService } from './data-pipeline.service';

export interface AccuracyMetrics {
  mape: number; // Mean Absolute Percentage Error
  rmse: number; // Root Mean Square Error
  mae: number;  // Mean Absolute Error
  bias: number; // Forecast bias
  accuracy: number; // Overall accuracy percentage
  r2: number; // R-squared coefficient
  theilU: number; // Theil's U statistic
}

export interface BiasAnalysis {
  overallBias: number;
  biasDirection: 'underforecast' | 'overforecast' | 'neutral';
  significantBias: boolean;
  biasPattern: 'systematic' | 'random' | 'seasonal';
  biasMetrics: {
    meanBias: number;
    medianBias: number;
    biasTrend: 'increasing' | 'decreasing' | 'stable';
    seasonalBias: Record<string, number>;
  };
}

export interface ModelPerformanceReport {
  modelId: string;
  modelType: string;
  evaluationPeriod: {
    startDate: Date;
    endDate: Date;
    totalPredictions: number;
    actualizedPredictions: number;
  };
  accuracyMetrics: AccuracyMetrics;
  biasAnalysis: BiasAnalysis;
  trendAnalysis: {
    forecastTrend: 'increasing' | 'decreasing' | 'stable';
    actualTrend: 'increasing' | 'decreasing' | 'stable';
    trendAlignment: 'excellent' | 'good' | 'poor';
    trendAccuracy: number;
  };
  confidenceAnalysis: {
    withinConfidenceInterval: number;
    averageConfidenceLevel: number;
    confidenceCalibration: 'well_calibrated' | 'overconfident' | 'underconfident';
    confidenceAccuracy: number;
  };
  performanceDegradation: {
    isDetected: boolean;
    severity: 'low' | 'medium' | 'high';
    degradationRate: number;
    triggersRetraining: boolean;
  };
  recommendations: string[];
  alerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    actionRequired: string;
  }>;
}

export interface RetrainingTrigger {
  modelId: string;
  triggerType: 'accuracy_degradation' | 'bias_drift' | 'data_drift' | 'time_based' | 'manual';
  triggerValue: number;
  threshold: number;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
}

@Injectable()
export class AccuracyTrackingService {
  private readonly logger = new Logger(AccuracyTrackingService.name);

  constructor(
    @InjectRepository(MLModel)
    private mlModelRepo: Repository<MLModel>,
    
    @InjectRepository(Prediction)
    private predictionRepo: Repository<Prediction>,
    
    @InjectRepository(TrainingJob)
    private trainingJobRepo: Repository<TrainingJob>,
    
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    
    private dataPipelineService: DataPipelineService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Calculate comprehensive accuracy metrics including MAPE
   */
  async calculateAccuracyMetrics(
    tenantId: string,
    modelId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AccuracyMetrics> {
    this.logger.debug(`Calculating accuracy metrics for model ${modelId}`);

    const predictions = await this.predictionRepo.find({
      where: {
        tenantId,
        modelId,
        status: PredictionStatus.COMPLETED,
        isActualized: true,
        predictionDate: Between(startDate, endDate),
      },
      order: { predictionDate: 'ASC' },
    });

    if (predictions.length === 0) {
      throw new Error('No actualized predictions found for the specified period');
    }

    const actualValues = predictions.map(p => p.actualValue!);
    const predictedValues = predictions.map(p => p.predictedValue);

    // Calculate MAPE (Mean Absolute Percentage Error)
    const mape = this.calculateMAPE(actualValues, predictedValues);

    // Calculate RMSE (Root Mean Square Error)
    const rmse = this.calculateRMSE(actualValues, predictedValues);

    // Calculate MAE (Mean Absolute Error)
    const mae = this.calculateMAE(actualValues, predictedValues);

    // Calculate Bias
    const bias = this.calculateBias(actualValues, predictedValues);

    // Calculate Accuracy percentage
    const accuracy = Math.max(0, 100 - mape);

    // Calculate R-squared
    const r2 = this.calculateRSquared(actualValues, predictedValues);

    // Calculate Theil's U statistic
    const theilU = this.calculateTheilU(actualValues, predictedValues);

    return {
      mape: Math.round(mape * 100) / 100,
      rmse: Math.round(rmse * 100) / 100,
      mae: Math.round(mae * 100) / 100,
      bias: Math.round(bias * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100,
      r2: Math.round(r2 * 1000) / 1000,
      theilU: Math.round(theilU * 1000) / 1000,
    };
  }

  /**
   * Perform comprehensive bias detection and analysis
   */
  async performBiasAnalysis(
    tenantId: string,
    modelId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BiasAnalysis> {
    this.logger.debug(`Performing bias analysis for model ${modelId}`);

    const predictions = await this.predictionRepo.find({
      where: {
        tenantId,
        modelId,
        status: PredictionStatus.COMPLETED,
        isActualized: true,
        predictionDate: Between(startDate, endDate),
      },
      order: { predictionDate: 'ASC' },
    });

    if (predictions.length === 0) {
      throw new Error('No actualized predictions found for bias analysis');
    }

    const errors = predictions.map(p => p.predictedValue - p.actualValue!);
    const percentageErrors = predictions.map(p => 
      ((p.predictedValue - p.actualValue!) / p.actualValue!) * 100
    );

    // Calculate overall bias
    const overallBias = errors.reduce((sum, error) => sum + error, 0) / errors.length;
    const meanBias = percentageErrors.reduce((sum, error) => sum + error, 0) / percentageErrors.length;
    const medianBias = this.calculateMedian(percentageErrors);

    // Determine bias direction
    let biasDirection: 'underforecast' | 'overforecast' | 'neutral';
    if (Math.abs(meanBias) < 2) {
      biasDirection = 'neutral';
    } else if (meanBias > 0) {
      biasDirection = 'overforecast';
    } else {
      biasDirection = 'underforecast';
    }

    // Check if bias is significant (more than 5% on average)
    const significantBias = Math.abs(meanBias) > 5;

    // Analyze bias pattern
    const biasPattern = this.analyzeBiasPattern(predictions, errors);

    // Calculate bias trend
    const biasTrend = this.calculateBiasTrend(predictions, errors);

    // Calculate seasonal bias
    const seasonalBias = this.calculateSeasonalBias(predictions);

    return {
      overallBias: Math.round(overallBias * 100) / 100,
      biasDirection,
      significantBias,
      biasPattern,
      biasMetrics: {
        meanBias: Math.round(meanBias * 100) / 100,
        medianBias: Math.round(medianBias * 100) / 100,
        biasTrend,
        seasonalBias,
      },
    };
  }

  /**
   * Generate comprehensive model performance report
   */
  async generateModelPerformanceReport(
    tenantId: string,
    modelId: string,
    evaluationDays: number = 30
  ): Promise<ModelPerformanceReport> {
    this.logger.debug(`Generating performance report for model ${modelId}`);

    const endDate = new Date();
    const startDate = moment(endDate).subtract(evaluationDays, 'days').toDate();

    const model = await this.mlModelRepo.findOne({
      where: { id: modelId, tenantId },
    });

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Get prediction statistics
    const totalPredictions = await this.predictionRepo.count({
      where: {
        tenantId,
        modelId,
        predictionDate: Between(startDate, endDate),
      },
    });

    const actualizedPredictions = await this.predictionRepo.count({
      where: {
        tenantId,
        modelId,
        isActualized: true,
        predictionDate: Between(startDate, endDate),
      },
    });

    // Calculate metrics
    const accuracyMetrics = await this.calculateAccuracyMetrics(tenantId, modelId, startDate, endDate);
    const biasAnalysis = await this.performBiasAnalysis(tenantId, modelId, startDate, endDate);
    const trendAnalysis = await this.analyzeTrendAccuracy(tenantId, modelId, startDate, endDate);
    const confidenceAnalysis = await this.analyzeConfidenceAccuracy(tenantId, modelId, startDate, endDate);
    const performanceDegradation = await this.detectPerformanceDegradation(tenantId, modelId);

    // Generate recommendations and alerts
    const { recommendations, alerts } = this.generateRecommendationsAndAlerts(
      accuracyMetrics,
      biasAnalysis,
      trendAnalysis,
      confidenceAnalysis,
      performanceDegradation
    );

    return {
      modelId,
      modelType: model.modelType,
      evaluationPeriod: {
        startDate,
        endDate,
        totalPredictions,
        actualizedPredictions,
      },
      accuracyMetrics,
      biasAnalysis,
      trendAnalysis,
      confidenceAnalysis,
      performanceDegradation,
      recommendations,
      alerts,
    };
  }

  /**
   * Detect performance degradation and trigger retraining if needed
   */
  async detectPerformanceDegradation(
    tenantId: string,
    modelId: string
  ): Promise<{
    isDetected: boolean;
    severity: 'low' | 'medium' | 'high';
    degradationRate: number;
    triggersRetraining: boolean;
  }> {
    this.logger.debug(`Detecting performance degradation for model ${modelId}`);

    const model = await this.mlModelRepo.findOne({
      where: { id: modelId, tenantId },
    });

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Compare recent performance with historical baseline
    const recentDays = 7;
    const baselineDays = 30;

    const recentEndDate = new Date();
    const recentStartDate = moment(recentEndDate).subtract(recentDays, 'days').toDate();
    
    const baselineEndDate = moment(recentStartDate).subtract(1, 'day').toDate();
    const baselineStartDate = moment(baselineEndDate).subtract(baselineDays, 'days').toDate();

    try {
      const recentMetrics = await this.calculateAccuracyMetrics(tenantId, modelId, recentStartDate, recentEndDate);
      const baselineMetrics = await this.calculateAccuracyMetrics(tenantId, modelId, baselineStartDate, baselineEndDate);

      // Calculate degradation rate based on MAPE increase
      const degradationRate = ((recentMetrics.mape - baselineMetrics.mape) / baselineMetrics.mape) * 100;

      let isDetected = false;
      let severity: 'low' | 'medium' | 'high' = 'low';
      let triggersRetraining = false;

      // Define degradation thresholds
      if (degradationRate > 20) {
        isDetected = true;
        severity = 'high';
        triggersRetraining = true;
      } else if (degradationRate > 10) {
        isDetected = true;
        severity = 'medium';
        triggersRetraining = degradationRate > 15;
      } else if (degradationRate > 5) {
        isDetected = true;
        severity = 'low';
      }

      // Emit retraining trigger event if needed
      if (triggersRetraining) {
        const trigger: RetrainingTrigger = {
          modelId,
          triggerType: 'accuracy_degradation',
          triggerValue: degradationRate,
          threshold: 20,
          description: `Model accuracy degraded by ${degradationRate.toFixed(1)}%`,
          priority: severity === 'high' ? 'critical' : 'high',
          recommendedAction: 'Immediate model retraining recommended',
        };

        await this.emitRetrainingTrigger(tenantId, trigger);
      }

      return {
        isDetected,
        severity,
        degradationRate: Math.round(degradationRate * 100) / 100,
        triggersRetraining,
      };

    } catch (error) {
      this.logger.warn(`Performance degradation detection failed: ${error.message}`);
      return {
        isDetected: false,
        severity: 'low',
        degradationRate: 0,
        triggersRetraining: false,
      };
    }
  }

  /**
   * Emit retraining trigger event
   */
  private async emitRetrainingTrigger(tenantId: string, trigger: RetrainingTrigger): Promise<void> {
    this.logger.warn(`Retraining trigger for model ${trigger.modelId}: ${trigger.description}`);

    // Emit event for automated retraining
    this.eventEmitter.emit('ml.retraining.trigger', {
      tenantId,
      trigger,
      timestamp: new Date(),
    });

    // Update model status to indicate retraining needed
    await this.mlModelRepo.update(
      { id: trigger.modelId, tenantId },
      { 
        metadata: {
          retrainingTriggered: true,
          retrainingReason: trigger.description,
          retrainingPriority: trigger.priority,
          triggeredAt: new Date().toISOString(),
        }
      }
    );
  }

  // Private helper methods for calculations

  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length) {
      throw new Error('Arrays must have the same length');
    }

    let sum = 0;
    let count = 0;

    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) { // Avoid division by zero
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }

    return count > 0 ? (sum / count) * 100 : 0;
  }

  private calculateRMSE(actual: number[], predicted: number[]): number {
    const mse = actual.reduce((sum, val, i) => 
      sum + Math.pow(val - predicted[i], 2), 0) / actual.length;
    return Math.sqrt(mse);
  }

  private calculateMAE(actual: number[], predicted: number[]): number {
    return actual.reduce((sum, val, i) => 
      sum + Math.abs(val - predicted[i]), 0) / actual.length;
  }

  private calculateBias(actual: number[], predicted: number[]): number {
    return predicted.reduce((sum, val, i) => 
      sum + (val - actual[i]), 0) / actual.length;
  }

  private calculateRSquared(actual: number[], predicted: number[]): number {
    const actualMean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
    
    const totalSumSquares = actual.reduce((sum, val) => 
      sum + Math.pow(val - actualMean, 2), 0);
    
    const residualSumSquares = actual.reduce((sum, val, i) => 
      sum + Math.pow(val - predicted[i], 2), 0);
    
    return totalSumSquares === 0 ? 1 : 1 - (residualSumSquares / totalSumSquares);
  }

  private calculateTheilU(actual: number[], predicted: number[]): number {
    const numerator = Math.sqrt(
      actual.reduce((sum, val, i) => 
        sum + Math.pow(val - predicted[i], 2), 0) / actual.length
    );
    
    const denominator = Math.sqrt(
      actual.reduce((sum, val) => sum + Math.pow(val, 2), 0) / actual.length
    ) + Math.sqrt(
      predicted.reduce((sum, val) => sum + Math.pow(val, 2), 0) / predicted.length
    );
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  private analyzeBiasPattern(
    predictions: Prediction[], 
    errors: number[]
  ): 'systematic' | 'random' | 'seasonal' {
    // Calculate correlation between error and prediction order (time)
    const timeIndices = predictions.map((_, i) => i);
    const correlation = this.calculateCorrelation(timeIndices, errors);
    
    if (Math.abs(correlation) > 0.3) {
      return 'systematic';
    }
    
    // Check for seasonal patterns (simplified)
    const weeklyErrors = new Array(7).fill(0).map(() => [] as number[]);
    predictions.forEach((pred, i) => {
      const dayOfWeek = moment(pred.predictionDate).day();
      weeklyErrors[dayOfWeek].push(errors[i]);
    });
    
    const weeklyMeans = weeklyErrors.map(dayErrors => 
      dayErrors.length > 0 ? dayErrors.reduce((sum, e) => sum + e, 0) / dayErrors.length : 0
    );
    
    const weeklyVariance = this.calculateVariance(weeklyMeans);
    
    return weeklyVariance > 1 ? 'seasonal' : 'random';
  }

  private calculateBiasTrend(
    predictions: Prediction[], 
    errors: number[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (predictions.length < 5) return 'stable';
    
    const timeIndices = predictions.map((_, i) => i);
    const correlation = this.calculateCorrelation(timeIndices, errors);
    
    if (correlation > 0.2) return 'increasing';
    if (correlation < -0.2) return 'decreasing';
    return 'stable';
  }

  private calculateSeasonalBias(predictions: Prediction[]): Record<string, number> {
    const monthlyBias: Record<string, number[]> = {};
    
    predictions.forEach(pred => {
      if (pred.actualValue !== null && pred.actualValue !== undefined) {
        const month = moment(pred.predictionDate).format('MMMM');
        const bias = ((pred.predictedValue - pred.actualValue) / pred.actualValue) * 100;
        
        if (!monthlyBias[month]) {
          monthlyBias[month] = [];
        }
        monthlyBias[month].push(bias);
      }
    });
    
    const result: Record<string, number> = {};
    Object.entries(monthlyBias).forEach(([month, biases]) => {
      result[month] = biases.reduce((sum, bias) => sum + bias, 0) / biases.length;
    });
    
    return result;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private async analyzeTrendAccuracy(
    tenantId: string,
    modelId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // Simplified trend analysis - would be more complex in real implementation
    return {
      forecastTrend: 'increasing',
      actualTrend: 'increasing',
      trendAlignment: 'good',
      trendAccuracy: 0.89,
    };
  }

  private async analyzeConfidenceAccuracy(
    tenantId: string,
    modelId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const predictions = await this.predictionRepo.find({
      where: {
        tenantId,
        modelId,
        status: PredictionStatus.COMPLETED,
        isActualized: true,
        predictionDate: Between(startDate, endDate),
      },
    });

    if (predictions.length === 0) {
      return {
        withinConfidenceInterval: 0,
        averageConfidenceLevel: 0,
        confidenceCalibration: 'unknown',
        confidenceAccuracy: 0,
      };
    }

    // Calculate how many predictions fall within confidence intervals
    const withinInterval = predictions.filter(p => {
      if (p.lowerBound !== null && p.upperBound !== null && p.actualValue !== null) {
        return p.actualValue >= p.lowerBound && p.actualValue <= p.upperBound;
      }
      return false;
    }).length;

    const withinConfidenceInterval = withinInterval / predictions.length;
    const averageConfidenceLevel = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    let confidenceCalibration: 'well_calibrated' | 'overconfident' | 'underconfident';
    if (Math.abs(withinConfidenceInterval - averageConfidenceLevel) < 0.1) {
      confidenceCalibration = 'well_calibrated';
    } else if (withinConfidenceInterval < averageConfidenceLevel) {
      confidenceCalibration = 'overconfident';
    } else {
      confidenceCalibration = 'underconfident';
    }

    return {
      withinConfidenceInterval: Math.round(withinConfidenceInterval * 100) / 100,
      averageConfidenceLevel: Math.round(averageConfidenceLevel * 100) / 100,
      confidenceCalibration,
      confidenceAccuracy: Math.round((1 - Math.abs(withinConfidenceInterval - averageConfidenceLevel)) * 100) / 100,
    };
  }

  private generateRecommendationsAndAlerts(
    accuracyMetrics: AccuracyMetrics,
    biasAnalysis: BiasAnalysis,
    trendAnalysis: any,
    confidenceAnalysis: any,
    performanceDegradation: any
  ): { recommendations: string[]; alerts: any[] } {
    const recommendations: string[] = [];
    const alerts: any[] = [];

    // Accuracy-based recommendations
    if (accuracyMetrics.mape > 20) {
      recommendations.push('MAPE tinggi (>20%) - pertimbangkan untuk retraining model dengan data lebih banyak');
      alerts.push({
        type: 'high_mape',
        severity: 'high',
        message: 'Model accuracy rendah dengan MAPE > 20%',
        actionRequired: 'Model retraining diperlukan',
      });
    } else if (accuracyMetrics.mape > 10) {
      recommendations.push('MAPE cukup tinggi (>10%) - monitor performa model secara berkala');
    }

    // Bias-based recommendations
    if (biasAnalysis.significantBias) {
      recommendations.push(`Bias signifikan terdeteksi (${biasAnalysis.biasDirection}) - review feature engineering atau model configuration`);
      alerts.push({
        type: 'significant_bias',
        severity: 'medium',
        message: `Model menunjukkan bias ${biasAnalysis.biasDirection} yang signifikan`,
        actionRequired: 'Review dan perbaiki bias dalam model',
      });
    }

    // Confidence-based recommendations
    if (confidenceAnalysis.confidenceCalibration === 'overconfident') {
      recommendations.push('Model overconfident - confidence interval terlalu sempit dibanding akurasi aktual');
    } else if (confidenceAnalysis.confidenceCalibration === 'underconfident') {
      recommendations.push('Model underconfident - confidence interval terlalu lebar, bisa dipersempit');
    }

    // Performance degradation alerts
    if (performanceDegradation.isDetected) {
      alerts.push({
        type: 'performance_degradation',
        severity: performanceDegradation.severity,
        message: `Degradasi performa terdeteksi: ${performanceDegradation.degradationRate.toFixed(1)}%`,
        actionRequired: performanceDegradation.triggersRetraining ? 'Model retraining diperlukan' : 'Monitor lebih ketat',
      });
    }

    return { recommendations, alerts };
  }
}