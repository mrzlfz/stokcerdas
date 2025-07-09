import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MLModel, ModelType, ModelStatus } from '../entities/ml-model.entity';
import { Prediction } from '../entities/prediction.entity';
import { PythonBridgeService, MLDataRequest } from './python-bridge.service';
import {
  DataPreprocessingService,
  TimeSeriesDataset,
} from './data-preprocessing.service';

// Types untuk model selection
export interface ModelEvaluation {
  modelType: ModelType;
  suitabilityScore: number;
  accuracy: {
    mape: number;
    mae: number;
    rmse: number;
    r_squared: number;
  };
  performance: {
    trainingTime: number;
    predictionTime: number;
    memoryUsage: number;
  };
  suitability: {
    dataSize: number; // 0-1 score for data size compatibility
    seasonality: number; // 0-1 score for seasonality handling
    interpretability: number; // 0-1 score for business interpretability
    scalability: number; // 0-1 score for production scalability
    indonesianContext: number; // 0-1 score for Indonesian market fit
  };
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface ModelRecommendation {
  recommendedModel: ModelEvaluation;
  alternatives: ModelEvaluation[];
  reason: string;
  confidence: number;
  businessJustification: string;
  indonesianMarketConsiderations: string[];
}

export interface DataCharacteristics {
  size: number;
  hasSeasonality: boolean;
  seasonalityStrength: number;
  trendStrength: number;
  volatility: number;
  missingDataPercentage: number;
  outlierPercentage: number;
  businessCycleStrength: number;
  ramadanEffectStrength: number;
  weekendPatternStrength: number;
}

export interface PredictionRequest {
  productId?: string;
  categoryId?: string;
  locationId?: string;
  timeHorizon: '7d' | '30d' | '90d';
  features?: Record<string, any>;
  predictionType?: string;
}

@Injectable()
export class ModelSelectionService {
  private readonly logger = new Logger(ModelSelectionService.name);

  constructor(
    @InjectRepository(MLModel)
    private readonly mlModelRepository: Repository<MLModel>,
    @InjectRepository(Prediction)
    private readonly predictionRepository: Repository<Prediction>,
    private readonly pythonBridgeService: PythonBridgeService,
    private readonly dataPreprocessingService: DataPreprocessingService,
  ) {}

  /**
   * Main method untuk select best model based on data characteristics
   */
  async selectBestModel(
    dataset: TimeSeriesDataset,
    request: PredictionRequest,
    tenantId: string,
  ): Promise<ModelRecommendation> {
    this.logger.log(
      `Starting model selection for dataset with ${dataset.timeSeries.length} data points`,
    );

    try {
      // 1. Analyze data characteristics
      const dataCharacteristics = this.analyzeDataCharacteristics(dataset);

      // 2. Evaluate all available model types
      const modelEvaluations: ModelEvaluation[] = [];

      const availableModels = [
        ModelType.ARIMA,
        ModelType.PROPHET,
        ModelType.XGBOOST,
      ];

      for (const modelType of availableModels) {
        try {
          const evaluation = await this.evaluateModel(
            modelType,
            dataset,
            dataCharacteristics,
            request,
          );
          modelEvaluations.push(evaluation);
          this.logger.log(
            `${modelType} evaluation completed: score ${evaluation.suitabilityScore.toFixed(
              3,
            )}`,
          );
        } catch (error) {
          this.logger.warn(
            `Model ${modelType} evaluation failed: ${error.message}`,
          );
        }
      }

      if (modelEvaluations.length === 0) {
        throw new Error('No models could be evaluated successfully');
      }

      // 3. Rank models and select best
      const rankedModels = this.rankModels(
        modelEvaluations,
        dataCharacteristics,
        request,
      );
      const bestModel = rankedModels[0];
      const alternatives = rankedModels.slice(1);

      // 4. Generate business justification
      const businessJustification = this.generateBusinessJustification(
        bestModel,
        dataCharacteristics,
        request,
      );

      const indonesianMarketConsiderations =
        this.getIndonesianMarketConsiderations(bestModel, dataset);

      const recommendation: ModelRecommendation = {
        recommendedModel: bestModel,
        alternatives,
        reason: this.explainSelection(bestModel, dataCharacteristics),
        confidence: bestModel.confidence,
        businessJustification,
        indonesianMarketConsiderations,
      };

      this.logger.log(
        `Model selection completed: ${
          bestModel.modelType
        } selected with confidence ${bestModel.confidence.toFixed(3)}`,
      );

      return recommendation;
    } catch (error) {
      this.logger.error(
        `Model selection failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Evaluate single model type untuk dataset
   */
  private async evaluateModel(
    modelType: ModelType,
    dataset: TimeSeriesDataset,
    dataCharacteristics: DataCharacteristics,
    request: PredictionRequest,
  ): Promise<ModelEvaluation> {
    const startTime = Date.now();

    // Check minimum data requirements
    if (!this.checkMinimumDataRequirements(modelType, dataset)) {
      throw new Error(
        `Insufficient data for ${modelType}: minimum requirements not met`,
      );
    }

    // Split data for cross-validation
    const { trainData, testData } = this.splitDataForValidation(
      dataset.timeSeries,
    );

    if (trainData.length < 20 || testData.length < 5) {
      throw new Error(
        `Insufficient data for validation split: train=${trainData.length}, test=${testData.length}`,
      );
    }

    // Prepare ML data request
    const mlDataRequest: MLDataRequest = {
      data_points: trainData.map(d => d.value),
      dates: trainData.map(d => d.date),
      forecast_steps: testData.length,
      seasonal: dataCharacteristics.hasSeasonality,
      confidence_level: 0.95,
      indonesian_context: {
        include_ramadan: true,
        include_lebaran: true,
        include_holidays: true,
        business_type: 'retail',
        location: 'jakarta',
      },
    };

    // Execute model training and prediction
    let modelResult: any;
    switch (modelType) {
      case ModelType.ARIMA:
        modelResult = await this.pythonBridgeService.executeARIMA(
          mlDataRequest,
        );
        break;
      case ModelType.PROPHET:
        modelResult = await this.pythonBridgeService.executeProphet(
          mlDataRequest,
        );
        break;
      case ModelType.XGBOOST:
        modelResult = await this.pythonBridgeService.executeXGBoost(
          mlDataRequest,
        );
        break;
      default:
        throw new Error(`Unsupported model type: ${modelType}`);
    }

    if (!modelResult || !modelResult.success) {
      throw new Error(`Model ${modelType} execution failed`);
    }

    // Calculate accuracy metrics
    const predictions = modelResult.forecasts.map(f => f.forecast);
    const actuals = testData.map(d => d.value);

    const accuracy = {
      mape: this.calculateMAPE(actuals, predictions),
      mae: this.calculateMAE(actuals, predictions),
      rmse: this.calculateRMSE(actuals, predictions),
      r_squared: this.calculateRSquared(actuals, predictions),
    };

    // Calculate performance metrics
    const executionTime = Date.now() - startTime;
    const performance = {
      trainingTime: modelResult.performance?.training_time || 0,
      predictionTime: modelResult.performance?.prediction_time || executionTime,
      memoryUsage: modelResult.performance?.memory_usage || 0,
    };

    // Assess model suitability
    const suitability = {
      dataSize: this.assessDataSizeCompatibility(modelType, trainData.length),
      seasonality: this.assessSeasonalityHandling(
        modelType,
        dataCharacteristics,
      ),
      interpretability: this.getModelInterpretability(modelType),
      scalability: this.getModelScalability(modelType),
      indonesianContext: this.assessIndonesianContextFit(modelType, dataset),
    };

    // Calculate overall suitability score
    const suitabilityScore = this.calculateOverallSuitabilityScore(
      accuracy,
      suitability,
      dataCharacteristics,
    );

    // Generate strengths, weaknesses, and recommendations
    const { strengths, weaknesses, recommendations } =
      this.generateModelInsights(
        modelType,
        accuracy,
        suitability,
        dataCharacteristics,
      );

    return {
      modelType,
      suitabilityScore,
      accuracy,
      performance,
      suitability,
      confidence: this.calculateConfidence(accuracy, suitability),
      strengths,
      weaknesses,
      recommendations,
    };
  }

  /**
   * Analyze data characteristics untuk model selection
   */
  private analyzeDataCharacteristics(
    dataset: TimeSeriesDataset,
  ): DataCharacteristics {
    const values = dataset.timeSeries.map(d => d.value);
    const businessContexts = dataset.timeSeries.map(d => d.business_context);

    // Basic statistics
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const volatility = Math.sqrt(variance) / mean;

    // Missing data analysis
    const missingDataCount = dataset.timeSeries.filter(
      d => d.is_interpolated,
    ).length;
    const missingDataPercentage =
      (missingDataCount / dataset.timeSeries.length) * 100;

    // Outlier detection (simple IQR method)
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
    const iqr = q3 - q1;
    const outlierCount = values.filter(
      v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr,
    ).length;
    const outlierPercentage = (outlierCount / values.length) * 100;

    // Business cycle strength (Indonesian context)
    const ramadanPoints = businessContexts.filter(bc => bc.is_ramadan).length;
    const lebaranPoints = businessContexts.filter(bc => bc.is_lebaran).length;
    const weekendPoints = businessContexts.filter(bc =>
      [0, 6].includes(
        new Date(
          dataset.timeSeries[businessContexts.indexOf(bc)].date,
        ).getDay(),
      ),
    ).length;

    const businessCycleStrength =
      (ramadanPoints + lebaranPoints) / businessContexts.length;
    const ramadanEffectStrength = ramadanPoints / businessContexts.length;
    const weekendPatternStrength = weekendPoints / businessContexts.length;

    return {
      size: dataset.timeSeries.length,
      hasSeasonality: dataset.metadata.has_seasonality,
      seasonalityStrength: dataset.metadata.seasonality_strength,
      trendStrength: dataset.metadata.trend_strength,
      volatility,
      missingDataPercentage,
      outlierPercentage,
      businessCycleStrength,
      ramadanEffectStrength,
      weekendPatternStrength,
    };
  }

  /**
   * Rank models based on suitability scores and business context
   */
  private rankModels(
    evaluations: ModelEvaluation[],
    dataCharacteristics: DataCharacteristics,
    request: PredictionRequest,
  ): ModelEvaluation[] {
    return evaluations.sort((a, b) => {
      // Primary ranking: overall suitability score
      let scoreA = a.suitabilityScore;
      let scoreB = b.suitabilityScore;

      // Adjust for business context
      if (request.timeHorizon === '7d') {
        // Short-term predictions: prefer faster models
        scoreA += a.modelType === ModelType.ARIMA ? 0.1 : 0;
        scoreB += b.modelType === ModelType.ARIMA ? 0.1 : 0;
      } else if (request.timeHorizon === '90d') {
        // Long-term predictions: prefer seasonal models
        scoreA += a.modelType === ModelType.PROPHET ? 0.1 : 0;
        scoreB += b.modelType === ModelType.PROPHET ? 0.1 : 0;
      }

      // Indonesian market bonus
      scoreA += a.suitability.indonesianContext * 0.05;
      scoreB += b.suitability.indonesianContext * 0.05;

      return scoreB - scoreA; // Descending order
    });
  }

  /**
   * Check minimum data requirements untuk each model type
   */
  private checkMinimumDataRequirements(
    modelType: ModelType,
    dataset: TimeSeriesDataset,
  ): boolean {
    const dataSize = dataset.timeSeries.length;

    switch (modelType) {
      case ModelType.ARIMA:
        return dataSize >= 20; // ARIMA needs minimum 20 points
      case ModelType.PROPHET:
        return dataSize >= 30; // Prophet needs minimum 30 points
      case ModelType.XGBOOST:
        return dataSize >= 50; // XGBoost needs minimum 50 points for features
      default:
        return dataSize >= 30;
    }
  }

  /**
   * Split data untuk cross-validation
   */
  private splitDataForValidation(timeSeries: any[]): {
    trainData: any[];
    testData: any[];
  } {
    const splitIndex = Math.floor(timeSeries.length * 0.8); // 80-20 split

    return {
      trainData: timeSeries.slice(0, splitIndex),
      testData: timeSeries.slice(splitIndex),
    };
  }

  /**
   * Assess data size compatibility untuk each model
   */
  private assessDataSizeCompatibility(
    modelType: ModelType,
    dataSize: number,
  ): number {
    switch (modelType) {
      case ModelType.ARIMA:
        if (dataSize < 20) return 0;
        if (dataSize < 50) return 0.6;
        if (dataSize < 100) return 0.8;
        return 1.0;

      case ModelType.PROPHET:
        if (dataSize < 30) return 0;
        if (dataSize < 60) return 0.7;
        if (dataSize < 120) return 0.9;
        return 1.0;

      case ModelType.XGBOOST:
        if (dataSize < 50) return 0;
        if (dataSize < 100) return 0.6;
        if (dataSize < 200) return 0.8;
        return 1.0;

      default:
        return 0.5;
    }
  }

  /**
   * Assess seasonality handling capability
   */
  private assessSeasonalityHandling(
    modelType: ModelType,
    dataChar: DataCharacteristics,
  ): number {
    const seasonalityBonus = dataChar.hasSeasonality
      ? dataChar.seasonalityStrength
      : 0.5;

    switch (modelType) {
      case ModelType.ARIMA:
        return dataChar.hasSeasonality ? seasonalityBonus * 0.8 : 0.9; // Good for non-seasonal, ok for seasonal

      case ModelType.PROPHET:
        return dataChar.hasSeasonality ? seasonalityBonus * 1.0 : 0.7; // Excellent for seasonal, good for non-seasonal

      case ModelType.XGBOOST:
        return dataChar.hasSeasonality ? seasonalityBonus * 0.9 : 0.8; // Good for both, depends on features

      default:
        return 0.5;
    }
  }

  /**
   * Get model interpretability score
   */
  private getModelInterpretability(modelType: ModelType): number {
    switch (modelType) {
      case ModelType.ARIMA:
        return 0.8; // High interpretability
      case ModelType.PROPHET:
        return 0.9; // Very high interpretability
      case ModelType.XGBOOST:
        return 0.6; // Moderate interpretability
      default:
        return 0.5;
    }
  }

  /**
   * Get model scalability score
   */
  private getModelScalability(modelType: ModelType): number {
    switch (modelType) {
      case ModelType.ARIMA:
        return 0.7; // Good scalability
      case ModelType.PROPHET:
        return 0.8; // Good scalability
      case ModelType.XGBOOST:
        return 0.9; // Excellent scalability
      default:
        return 0.5;
    }
  }

  /**
   * Assess Indonesian context fit
   */
  private assessIndonesianContextFit(
    modelType: ModelType,
    dataset: TimeSeriesDataset,
  ): number {
    const businessCycleStrength =
      dataset.metadata.business_context?.avg_business_impact || 1;

    switch (modelType) {
      case ModelType.ARIMA:
        return 0.7; // Good for Indonesian patterns
      case ModelType.PROPHET:
        return 0.95; // Excellent for Indonesian holidays and patterns
      case ModelType.XGBOOST:
        return 0.8; // Good with proper feature engineering
      default:
        return 0.5;
    }
  }

  /**
   * Calculate overall suitability score
   */
  private calculateOverallSuitabilityScore(
    accuracy: any,
    suitability: any,
    dataChar: DataCharacteristics,
  ): number {
    // Weights untuk different factors
    const weights = {
      accuracy: 0.4,
      suitability: 0.4,
      dataQuality: 0.2,
    };

    // Accuracy score (lower MAPE is better)
    const accuracyScore = Math.max(0, 1 - accuracy.mape / 100);

    // Suitability score (average of all suitability factors)
    const suitabilityScore =
      (suitability.dataSize +
        suitability.seasonality +
        suitability.interpretability +
        suitability.scalability +
        suitability.indonesianContext) /
      5;

    // Data quality score
    const dataQualityScore = Math.max(
      0,
      1 -
        dataChar.missingDataPercentage / 100 -
        dataChar.outlierPercentage / 100,
    );

    return (
      accuracyScore * weights.accuracy +
      suitabilityScore * weights.suitability +
      dataQualityScore * weights.dataQuality
    );
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(accuracy: any, suitability: any): number {
    // High accuracy + high suitability = high confidence
    const accuracyConfidence = Math.max(0, 1 - accuracy.mape / 100);
    const suitabilityConfidence =
      (suitability.dataSize +
        suitability.seasonality +
        suitability.interpretability) /
      3;

    return (accuracyConfidence + suitabilityConfidence) / 2;
  }

  /**
   * Generate model insights (strengths, weaknesses, recommendations)
   */
  private generateModelInsights(
    modelType: ModelType,
    accuracy: any,
    suitability: any,
    dataChar: DataCharacteristics,
  ): { strengths: string[]; weaknesses: string[]; recommendations: string[] } {
    const insights = {
      strengths: [] as string[],
      weaknesses: [] as string[],
      recommendations: [] as string[],
    };

    switch (modelType) {
      case ModelType.ARIMA:
        insights.strengths.push(
          'Cepat dan efisien untuk prediksi jangka pendek',
        );
        insights.strengths.push('Baik untuk data tanpa seasonality kompleks');
        if (accuracy.mape < 10)
          insights.strengths.push('Akurasi tinggi untuk dataset ini');

        if (dataChar.hasSeasonality && dataChar.seasonalityStrength > 0.5) {
          insights.weaknesses.push(
            'Kurang optimal untuk seasonal patterns yang kuat',
          );
        }
        if (dataChar.size < 50) {
          insights.weaknesses.push(
            'Performa lebih baik dengan lebih banyak data historis',
          );
        }

        insights.recommendations.push(
          'Ideal untuk prediksi harian dan mingguan',
        );
        insights.recommendations.push(
          'Kombinasikan dengan model seasonal untuk akurasi lebih baik',
        );
        break;

      case ModelType.PROPHET:
        insights.strengths.push(
          'Excellent untuk seasonal patterns dan holidays',
        );
        insights.strengths.push(
          'Otomatis mendeteksi Ramadan dan Lebaran effects',
        );
        insights.strengths.push(
          'Interpretable components (trend, seasonal, holidays)',
        );

        if (dataChar.size < 60) {
          insights.weaknesses.push(
            'Membutuhkan minimal 60 hari data untuk performa optimal',
          );
        }
        if (dataChar.volatility > 0.5) {
          insights.weaknesses.push(
            'Sensitif terhadap data yang sangat volatile',
          );
        }

        insights.recommendations.push('Perfect untuk Indonesian SMB patterns');
        insights.recommendations.push(
          'Gunakan untuk prediksi bulanan dan seasonal planning',
        );
        break;

      case ModelType.XGBOOST:
        insights.strengths.push('Sangat baik untuk non-linear patterns');
        insights.strengths.push('Dapat menangkap complex feature interactions');
        if (dataChar.businessCycleStrength > 0.3) {
          insights.strengths.push('Excellent untuk complex business cycles');
        }

        if (dataChar.size < 100) {
          insights.weaknesses.push(
            'Membutuhkan banyak data untuk feature engineering optimal',
          );
        }
        insights.weaknesses.push(
          'Kurang interpretable dibanding ARIMA/Prophet',
        );

        insights.recommendations.push(
          'Gunakan untuk produk dengan pola kompleks',
        );
        insights.recommendations.push(
          'Kombinasikan dengan domain expertise untuk feature engineering',
        );
        break;
    }

    return insights;
  }

  /**
   * Generate business justification untuk model selection
   */
  private generateBusinessJustification(
    bestModel: ModelEvaluation,
    dataChar: DataCharacteristics,
    request: PredictionRequest,
  ): string {
    const justifications = [];

    // Accuracy justification
    if (bestModel.accuracy.mape < 10) {
      justifications.push(
        `Model ${
          bestModel.modelType
        } memberikan akurasi tinggi (MAPE: ${bestModel.accuracy.mape.toFixed(
          1,
        )}%)`,
      );
    } else if (bestModel.accuracy.mape < 15) {
      justifications.push(
        `Model ${
          bestModel.modelType
        } memberikan akurasi baik (MAPE: ${bestModel.accuracy.mape.toFixed(
          1,
        )}%)`,
      );
    }

    // Data characteristics justification
    if (dataChar.hasSeasonality && bestModel.modelType === ModelType.PROPHET) {
      justifications.push(
        'Prophet optimal untuk seasonal patterns dan Indonesian holidays',
      );
    }

    if (
      dataChar.businessCycleStrength > 0.3 &&
      bestModel.modelType === ModelType.XGBOOST
    ) {
      justifications.push(
        'XGBoost menangkap complex business cycles dengan baik',
      );
    }

    // Time horizon justification
    if (
      request.timeHorizon === '7d' &&
      bestModel.modelType === ModelType.ARIMA
    ) {
      justifications.push('ARIMA efficient untuk prediksi jangka pendek');
    } else if (
      request.timeHorizon === '90d' &&
      bestModel.modelType === ModelType.PROPHET
    ) {
      justifications.push('Prophet reliable untuk prediksi jangka panjang');
    }

    // Indonesian context
    if (bestModel.suitability.indonesianContext > 0.8) {
      justifications.push('Model ini dioptimalkan untuk pola bisnis Indonesia');
    }

    return justifications.join('. ') + '.';
  }

  /**
   * Get Indonesian market considerations
   */
  private getIndonesianMarketConsiderations(
    bestModel: ModelEvaluation,
    dataset: TimeSeriesDataset,
  ): string[] {
    const considerations = [];

    // Ramadan considerations
    const ramadanPoints =
      dataset.metadata.business_context?.ramadan_periods || 0;
    if (ramadanPoints > 0) {
      considerations.push(
        'Model memperhitungkan efek Ramadan pada pola konsumsi',
      );
    }

    // Lebaran considerations
    const lebaranPoints =
      dataset.metadata.business_context?.lebaran_periods || 0;
    if (lebaranPoints > 0) {
      considerations.push(
        'Model mengantisipasi surge Lebaran untuk inventory planning',
      );
    }

    // Holiday considerations
    const holidaysCount =
      dataset.metadata.business_context?.holidays_included || 0;
    if (holidaysCount > 0) {
      considerations.push(
        `Model terintegrasi dengan ${holidaysCount} hari libur nasional Indonesia`,
      );
    }

    // Weekend patterns
    considerations.push(
      'Model mempertimbangkan pola weekend shopping Indonesia',
    );

    // Payday effects
    considerations.push('Model memperhitungkan efek gajian awal/akhir bulan');

    // Regional considerations
    if (bestModel.modelType === ModelType.PROPHET) {
      considerations.push(
        'Prophet dapat diadaptasi untuk perbedaan regional (WIB/WITA/WIT)',
      );
    }

    return considerations;
  }

  /**
   * Explain model selection reasoning
   */
  private explainSelection(
    bestModel: ModelEvaluation,
    dataChar: DataCharacteristics,
  ): string {
    const reasons = [];

    reasons.push(
      `Suitability score tertinggi: ${bestModel.suitabilityScore.toFixed(3)}`,
    );
    reasons.push(`MAPE: ${bestModel.accuracy.mape.toFixed(1)}%`);

    if (dataChar.hasSeasonality && bestModel.modelType === ModelType.PROPHET) {
      reasons.push('Optimal untuk seasonal data');
    }

    if (bestModel.suitability.indonesianContext > 0.8) {
      reasons.push('Excellent fit untuk Indonesian market');
    }

    return reasons.join(', ');
  }

  // Utility functions untuk accuracy calculations
  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length) return 100;

    let sum = 0;
    let count = 0;

    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }

    return count > 0 ? (sum / count) * 100 : 100;
  }

  private calculateMAE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length) return Number.MAX_VALUE;

    const sum = actual.reduce(
      (acc, val, idx) => acc + Math.abs(val - predicted[idx]),
      0,
    );
    return sum / actual.length;
  }

  private calculateRMSE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length) return Number.MAX_VALUE;

    const sum = actual.reduce(
      (acc, val, idx) => acc + Math.pow(val - predicted[idx], 2),
      0,
    );
    return Math.sqrt(sum / actual.length);
  }

  private calculateRSquared(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length) return 0;

    const actualMean =
      actual.reduce((sum, val) => sum + val, 0) / actual.length;

    const totalSumSquares = actual.reduce(
      (sum, val) => sum + Math.pow(val - actualMean, 2),
      0,
    );
    const residualSumSquares = actual.reduce(
      (sum, val, idx) => sum + Math.pow(val - predicted[idx], 2),
      0,
    );

    if (totalSumSquares === 0) return 0;

    return Math.max(0, 1 - residualSumSquares / totalSumSquares);
  }
}
