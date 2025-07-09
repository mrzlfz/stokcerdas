import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import moment from 'moment-timezone';

import { MLModel } from '../entities/ml-model.entity';
import { Prediction } from '../entities/prediction.entity';
import { BusinessContextEnrichmentService } from './business-context-enrichment.service';
import {
  IndonesianBusinessCalendarService,
  BusinessCategory,
} from './indonesian-business-calendar.service';

/**
 * PHASE 2.6: Cultural Pattern Learning Service 🧠
 *
 * Advanced machine learning system untuk continuous learning dari cultural patterns
 * dan behavioral data. Automatically adapts predictions berdasarkan evolving Indonesian
 * cultural trends dan consumer behavior patterns.
 */

export interface CulturalLearningRequest {
  tenantId: string;
  productIds?: string[];
  categoryIds?: string[];
  learningPeriod: LearningPeriod;
  analysisDepth: 'basic' | 'advanced' | 'deep_learning';
  includeRegionalVariations: boolean;
  includeBehavioralShifts: boolean;
}

export interface LearningPeriod {
  startDate: Date;
  endDate: Date;
  trainingWindow: number; // months
  validationWindow: number; // months
  minDataPoints: number;
}

export interface LearnedCulturalPattern {
  patternId: string;
  tenantId: string;
  discoveredAt: Date;
  lastUpdated: Date;

  // Pattern characteristics
  patternName: string;
  description: string;
  category: PatternCategory;
  strength: number; // 0-1 confidence score
  stability: number; // how consistent the pattern is

  // Pattern data
  triggerConditions: TriggerCondition[];
  impactProfile: ImpactProfile;
  temporalCharacteristics: TemporalCharacteristics;

  // Learning metadata
  discoveryMethod:
    | 'statistical'
    | 'ml_clustering'
    | 'anomaly_detection'
    | 'correlation_analysis';
  trainingAccuracy: number;
  validationAccuracy: number;
  sampleSize: number;

  // Evolution tracking
  evolutionHistory: PatternEvolution[];
  trendDirection:
    | 'strengthening'
    | 'stable'
    | 'weakening'
    | 'emerging'
    | 'declining';

  // Business relevance
  businessRelevance: BusinessRelevance;
  actionableInsights: ActionableInsight[];
  integrationStatus: 'candidate' | 'testing' | 'active' | 'deprecated';
}

export interface PatternCategory {
  primary:
    | 'religious'
    | 'cultural'
    | 'economic'
    | 'social'
    | 'temporal'
    | 'behavioral';
  secondary?: string[];
  tags: string[];
}

export interface TriggerCondition {
  conditionId: string;
  type:
    | 'temporal'
    | 'cultural_event'
    | 'economic_indicator'
    | 'social_trend'
    | 'external_factor';
  description: string;
  threshold?: number;
  operator?:
    | 'greater_than'
    | 'less_than'
    | 'equals'
    | 'contains'
    | 'matches_pattern';
  value?: any;
  confidence: number;
}

export interface ImpactProfile {
  demandMultiplier: number;
  varianceRange: [number, number]; // min, max variance
  affectedProducts: ProductImpact[];
  regionalVariation: RegionalImpact[];
  demographicInfluence: DemographicImpact[];
  channelEffects: ChannelImpact[];
}

export interface ProductImpact {
  productId?: string;
  categoryId?: string;
  impactStrength: number;
  confidence: number;
  correlationCoefficient: number;
  elasticity: number;
}

export interface RegionalImpact {
  regionCode: string;
  regionName: string;
  impactMultiplier: number;
  confidence: number;
  uniqueFactors: string[];
}

export interface DemographicImpact {
  ageGroup: string;
  incomeLevel: string;
  educationLevel: string;
  urbanRural: 'urban' | 'rural';
  impactStrength: number;
  adoptionRate: number;
}

export interface ChannelImpact {
  channel: 'online' | 'offline' | 'mobile' | 'social_commerce' | 'marketplace';
  impactMultiplier: number;
  preferenceShift: number;
  usagePattern: UsagePattern;
}

export interface UsagePattern {
  peakHours: number[];
  peakDays: string[];
  durationMinutes: number;
  frequency: 'high' | 'medium' | 'low';
}

export interface TemporalCharacteristics {
  frequency: FrequencyPattern;
  duration: DurationPattern;
  timing: TimingPattern;
  seasonality: SeasonalityPattern;
}

export interface FrequencyPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'annual' | 'irregular' | 'one_time';
  interval?: number;
  regularity: number; // 0-1 how regular the pattern is
  nextOccurrence?: Date;
}

export interface DurationPattern {
  averageDays: number;
  varianceDays: number;
  buildupDays: number; // days before peak
  decayDays: number; // days after peak
}

export interface TimingPattern {
  preferredTimeOfDay: number[]; // hours 0-23
  preferredDaysOfWeek: number[]; // 0-6
  preferredDaysOfMonth: number[]; // 1-31
  timezoneSensitive: boolean;
}

export interface SeasonalityPattern {
  hasSeasonality: boolean;
  seasonalPeriod?: number; // days
  seasonalStrength?: number;
  peakMonths: number[];
  lowMonths: number[];
}

export interface PatternEvolution {
  timestamp: Date;
  version: string;
  changes: PatternChange[];
  triggerEvent?: string;
  performanceMetrics: EvolutionMetrics;
}

export interface PatternChange {
  changeType:
    | 'strength_increase'
    | 'strength_decrease'
    | 'timing_shift'
    | 'scope_expansion'
    | 'scope_reduction';
  description: string;
  magnitude: number;
  confidence: number;
  evidenceSources: string[];
}

export interface EvolutionMetrics {
  accuracyChange: number;
  predictionImprovement: number;
  businessImpactChange: number;
  adaptationSpeed: number;
}

export interface BusinessRelevance {
  revenueImpact: number; // estimated revenue impact percentage
  riskLevel: 'low' | 'medium' | 'high';
  strategicImportance: 'low' | 'medium' | 'high' | 'critical';
  implementationComplexity: 'simple' | 'moderate' | 'complex';
  timeToValue: number; // days
}

export interface ActionableInsight {
  insightId: string;
  category: 'inventory' | 'pricing' | 'marketing' | 'operations' | 'strategic';
  title: string;
  description: string;
  recommendation: string;
  expectedBenefit: string;
  implementationSteps: ImplementationStep[];
  resources: ResourceEstimate[];
  timeline: InsightTimeline;
  kpiMetrics: KPIMetric[];
}

export interface ImplementationStep {
  stepId: string;
  description: string;
  owner: string;
  estimatedDays: number;
  dependencies: string[];
  deliverables: string[];
}

export interface ResourceEstimate {
  type: 'budget' | 'staff' | 'technology' | 'data';
  amount: number;
  unit: string;
  justification: string;
}

export interface InsightTimeline {
  preparationDays: number;
  implementationDays: number;
  measurementDays: number;
  totalDays: number;
}

export interface KPIMetric {
  metricName: string;
  currentValue?: number;
  targetValue: number;
  unit: string;
  measurementMethod: string;
}

export interface CulturalLearningResults {
  requestId: string;
  tenantId: string;
  generatedAt: Date;
  processingTime: number;

  // Discovery results
  newPatterns: LearnedCulturalPattern[];
  updatedPatterns: LearnedCulturalPattern[];
  deprecatedPatterns: string[]; // pattern IDs

  // Learning insights
  learningMetrics: LearningMetrics;
  qualityAssessment: QualityAssessment;
  recommendations: LearningRecommendation[];

  // Integration status
  integrationResults: IntegrationResult[];
  performanceImpact: PerformanceImpact;

  // Next steps
  suggestedActions: SuggestedAction[];
  nextLearningDate: Date;
}

export interface LearningMetrics {
  totalPatternsAnalyzed: number;
  newPatternsDiscovered: number;
  patternsUpdated: number;
  patternsDeprecated: number;
  averagePatternStrength: number;
  learningAccuracy: number;
  predictionImprovement: number;
}

export interface QualityAssessment {
  dataQualityScore: number;
  patternReliabilityScore: number;
  businessRelevanceScore: number;
  implementabilityScore: number;
  overallQualityScore: number;
  qualityIssues: QualityIssue[];
}

export interface QualityIssue {
  issueType:
    | 'insufficient_data'
    | 'low_confidence'
    | 'conflicting_patterns'
    | 'outdated_data';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendedAction: string;
}

export interface LearningRecommendation {
  recommendationType:
    | 'data_collection'
    | 'pattern_investigation'
    | 'model_adjustment'
    | 'business_action';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedBenefit: string;
  implementationGuide: string;
}

export interface IntegrationResult {
  patternId: string;
  integrationStatus: 'success' | 'partial' | 'failed';
  integrationDetails: string;
  performanceChange: number;
  businessImpactChange: number;
  issues: string[];
}

export interface PerformanceImpact {
  overallAccuracyChange: number;
  predictionLatencyChange: number;
  businessMetricImprovements: BusinessMetricImprovement[];
  resourceConsumptionChange: number;
}

export interface BusinessMetricImprovement {
  metric: string;
  improvementPercentage: number;
  confidence: number;
  measurementPeriod: string;
}

export interface SuggestedAction {
  actionType: 'immediate' | 'short_term' | 'long_term';
  category: 'optimization' | 'investigation' | 'implementation' | 'monitoring';
  description: string;
  expectedOutcome: string;
  priority: number; // 1-10
}

@Injectable()
export class CulturalPatternLearningService {
  private readonly logger = new Logger(CulturalPatternLearningService.name);
  private learnedPatterns: Map<string, LearnedCulturalPattern> = new Map();

  constructor(
    @InjectRepository(MLModel)
    private readonly mlModelRepo: Repository<MLModel>,
    @InjectRepository(Prediction)
    private readonly predictionRepo: Repository<Prediction>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
    private readonly businessContextService: BusinessContextEnrichmentService,
    private readonly indonesianCalendarService: IndonesianBusinessCalendarService,
  ) {
    // Delay initialization to ensure all dependencies are ready
    setTimeout(() => this.initializePatternLearning(), 1000);
  }

  /**
   * Initialize pattern learning system
   */
  private async initializePatternLearning(): Promise<void> {
    this.logger.log('Initializing Cultural Pattern Learning System');

    // Skip cache loading in development to avoid compatibility issues
    const environment = process.env.NODE_ENV || 'development';
    if (environment !== 'development') {
      // Load previously learned patterns from cache
      try {
        // Check if cache manager is properly initialized
        if (this.cacheManager && typeof this.cacheManager.get === 'function') {
          const cachedPatterns = await this.cacheManager.get<
            LearnedCulturalPattern[]
          >('learned_patterns');
          if (cachedPatterns) {
            cachedPatterns.forEach(pattern => {
              this.learnedPatterns.set(pattern.patternId, pattern);
            });
            this.logger.log(
              `Loaded ${cachedPatterns.length} previously learned patterns`,
            );
          }
        } else {
          this.logger.warn(
            'Cache manager not properly initialized, skipping pattern cache loading',
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to load cached patterns: ${error.message}`);
      }
    } else {
      this.logger.log('Pattern cache loading skipped in development mode');
    }
  }

  /**
   * Main method untuk cultural pattern learning
   */
  async performCulturalLearning(
    request: CulturalLearningRequest,
  ): Promise<CulturalLearningResults> {
    const startTime = Date.now();
    const requestId = `cpl_${request.tenantId}_${Date.now()}`;

    this.logger.log(
      `Starting cultural pattern learning for tenant ${request.tenantId}`,
    );

    try {
      // 1. Collect and preprocess historical data
      const historicalData = await this.collectHistoricalData(request);

      // 2. Discover new patterns
      const newPatterns = await this.discoverNewPatterns(
        request,
        historicalData,
      );

      // 3. Update existing patterns
      const updatedPatterns = await this.updateExistingPatterns(
        request,
        historicalData,
      );

      // 4. Identify deprecated patterns
      const deprecatedPatterns = await this.identifyDeprecatedPatterns(
        request,
        historicalData,
      );

      // 5. Assess pattern quality
      const qualityAssessment = await this.assessPatternQuality(
        newPatterns,
        updatedPatterns,
      );

      // 6. Generate learning metrics
      const learningMetrics = this.calculateLearningMetrics(
        newPatterns,
        updatedPatterns,
        deprecatedPatterns,
      );

      // 7. Create integration results
      const integrationResults = await this.integratePatterns(
        newPatterns,
        updatedPatterns,
      );

      // 8. Assess performance impact
      const performanceImpact = await this.assessPerformanceImpact(
        request,
        integrationResults,
      );

      // 9. Generate recommendations
      const recommendations = await this.generateLearningRecommendations(
        request,
        newPatterns,
        updatedPatterns,
        qualityAssessment,
      );

      // 10. Suggest next actions
      const suggestedActions = this.generateSuggestedActions(
        learningMetrics,
        qualityAssessment,
        performanceImpact,
      );

      const processingTime = Date.now() - startTime;

      const results: CulturalLearningResults = {
        requestId,
        tenantId: request.tenantId,
        generatedAt: new Date(),
        processingTime,
        newPatterns,
        updatedPatterns,
        deprecatedPatterns,
        learningMetrics,
        qualityAssessment,
        recommendations,
        integrationResults,
        performanceImpact,
        suggestedActions,
        nextLearningDate: moment().add(7, 'days').toDate(), // Weekly learning cycles
      };

      // Cache the results (skip in development)
      const environment = process.env.NODE_ENV || 'development';
      if (
        environment !== 'development' &&
        this.cacheManager &&
        typeof this.cacheManager.set === 'function'
      ) {
        await this.cacheManager.set(
          `learning_results_${requestId}`,
          results,
          7 * 24 * 60 * 60 * 1000, // 7 days
        );

        // Update learned patterns cache
        const allPatterns = Array.from(this.learnedPatterns.values());
        await this.cacheManager.set(
          'learned_patterns',
          allPatterns,
          30 * 24 * 60 * 60 * 1000, // 30 days
        );
      }

      // Emit learning completion event
      this.eventEmitter.emit('cultural.learning.completed', {
        tenantId: request.tenantId,
        requestId,
        results,
        timestamp: new Date(),
      });

      this.logger.log(
        `Cultural pattern learning completed for ${request.tenantId}: ` +
          `${newPatterns.length} new, ${updatedPatterns.length} updated, ` +
          `${deprecatedPatterns.length} deprecated patterns in ${processingTime}ms`,
      );

      return results;
    } catch (error) {
      this.logger.error(
        `Cultural pattern learning failed for ${request.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Collect historical data for pattern learning
   */
  private async collectHistoricalData(
    request: CulturalLearningRequest,
  ): Promise<any> {
    this.logger.debug('Collecting historical data for pattern learning');

    const endDate = request.learningPeriod.endDate;
    const startDate = moment(endDate)
      .subtract(request.learningPeriod.trainingWindow, 'months')
      .toDate();

    // Collect prediction data
    const predictions = await this.predictionRepo.find({
      where: {
        tenantId: request.tenantId,
        predictionDate: Between(startDate, endDate),
        isActualized: true,
      },
      order: { predictionDate: 'ASC' },
    });

    // Group by products if specified
    const productGroups = new Map();
    predictions.forEach(pred => {
      const key = (pred.metadata as any)?.productId || 'unknown';
      if (!productGroups.has(key)) {
        productGroups.set(key, []);
      }
      productGroups.get(key).push(pred);
    });

    return {
      predictions,
      productGroups,
      timeRange: { startDate, endDate },
      dataPoints: predictions.length,
    };
  }

  /**
   * Discover new cultural patterns using machine learning
   */
  private async discoverNewPatterns(
    request: CulturalLearningRequest,
    historicalData: any,
  ): Promise<LearnedCulturalPattern[]> {
    this.logger.debug('Discovering new cultural patterns');

    const newPatterns: LearnedCulturalPattern[] = [];

    // 1. Anomaly detection for unusual spikes
    const anomalies = await this.detectAnomalies(historicalData);
    for (const anomaly of anomalies) {
      if (anomaly.significance > 0.7) {
        const pattern = await this.createPatternFromAnomaly(
          request.tenantId,
          anomaly,
        );
        if (pattern) newPatterns.push(pattern);
      }
    }

    // 2. Correlation analysis with cultural events
    const correlations = await this.analyzeCorrelationsWithCulturalEvents(
      request,
      historicalData,
    );
    for (const correlation of correlations) {
      if (correlation.strength > 0.6) {
        const pattern = await this.createPatternFromCorrelation(
          request.tenantId,
          correlation,
        );
        if (pattern) newPatterns.push(pattern);
      }
    }

    // 3. Temporal pattern discovery
    const temporalPatterns = await this.discoverTemporalPatterns(
      historicalData,
    );
    for (const tempPattern of temporalPatterns) {
      if (tempPattern.confidence > 0.75) {
        const pattern = await this.createPatternFromTemporal(
          request.tenantId,
          tempPattern,
        );
        if (pattern) newPatterns.push(pattern);
      }
    }

    // 4. Behavioral shift detection
    if (request.includeBehavioralShifts) {
      const behavioralShifts = await this.detectBehavioralShifts(
        request,
        historicalData,
      );
      for (const shift of behavioralShifts) {
        if (shift.magnitude > 0.15) {
          // 15% change threshold
          const pattern = await this.createPatternFromBehavioralShift(
            request.tenantId,
            shift,
          );
          if (pattern) newPatterns.push(pattern);
        }
      }
    }

    this.logger.log(`Discovered ${newPatterns.length} new cultural patterns`);
    return newPatterns;
  }

  /**
   * Detect anomalies in historical data
   */
  private async detectAnomalies(historicalData: any): Promise<any[]> {
    const anomalies = [];

    // Simple statistical anomaly detection using z-score
    for (const [
      productId,
      predictions,
    ] of historicalData.productGroups.entries()) {
      const values = predictions.map(p => p.actualValue);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length;
      const stdDev = Math.sqrt(variance);

      predictions.forEach((pred, index) => {
        const zScore = Math.abs((pred.actualValue - mean) / stdDev);
        if (zScore > 2.5) {
          // 2.5 sigma threshold
          anomalies.push({
            productId,
            date: pred.predictionDate,
            value: pred.actualValue,
            expectedValue: mean,
            zScore,
            significance: Math.min(zScore / 4, 1), // Normalize to 0-1
            type: pred.actualValue > mean ? 'spike' : 'drop',
          });
        }
      });
    }

    return anomalies;
  }

  /**
   * Analyze correlations with cultural events
   */
  private async analyzeCorrelationsWithCulturalEvents(
    request: CulturalLearningRequest,
    historicalData: any,
  ): Promise<any[]> {
    const correlations = [];

    // Get cultural events for the period
    const startDate = historicalData.timeRange.startDate;
    const endDate = historicalData.timeRange.endDate;
    const current = moment(startDate);

    const culturalEvents = [];
    while (current.isSameOrBefore(endDate)) {
      const businessContext =
        await this.indonesianCalendarService.getBusinessContext(
          current.toDate(),
          'WIB',
          BusinessCategory.FOOD_BEVERAGE, // Default to food & beverage as most common retail category
        );

      if (businessContext.holiday) {
        culturalEvents.push({
          date: current.toDate(),
          name: businessContext.holiday.name,
          type: businessContext.holiday.type,
          impact: businessContext.businessImpact.overallMultiplier,
        });
      }

      current.add(1, 'day');
    }

    // Calculate correlations
    for (const [
      productId,
      predictions,
    ] of historicalData.productGroups.entries()) {
      for (const event of culturalEvents) {
        const eventDate = moment(event.date);

        // Look for predictions within 7 days of the event
        const nearbyPredictions = predictions.filter(pred => {
          const predDate = moment(pred.predictionDate);
          return Math.abs(predDate.diff(eventDate, 'days')) <= 7;
        });

        if (nearbyPredictions.length > 0) {
          const avgValue =
            nearbyPredictions.reduce((sum, pred) => sum + pred.actualValue, 0) /
            nearbyPredictions.length;
          const allValues = predictions.map(p => p.actualValue);
          const baselineAvg =
            allValues.reduce((sum, val) => sum + val, 0) / allValues.length;

          const correlation = (avgValue - baselineAvg) / baselineAvg;

          if (Math.abs(correlation) > 0.1) {
            // 10% change threshold
            correlations.push({
              productId,
              eventName: event.name,
              eventType: event.type,
              eventDate: event.date,
              strength: Math.abs(correlation),
              direction: correlation > 0 ? 'positive' : 'negative',
              magnitude: Math.abs(correlation),
              sampleSize: nearbyPredictions.length,
            });
          }
        }
      }
    }

    return correlations;
  }

  /**
   * Discover temporal patterns
   */
  private async discoverTemporalPatterns(historicalData: any): Promise<any[]> {
    const patterns = [];

    for (const [
      productId,
      predictions,
    ] of historicalData.productGroups.entries()) {
      // Weekly patterns
      const weeklyPattern = this.analyzeWeeklyPattern(predictions);
      if (weeklyPattern.confidence > 0.6) {
        patterns.push({
          productId,
          type: 'weekly',
          pattern: weeklyPattern,
          confidence: weeklyPattern.confidence,
        });
      }

      // Monthly patterns
      const monthlyPattern = this.analyzeMonthlyPattern(predictions);
      if (monthlyPattern.confidence > 0.6) {
        patterns.push({
          productId,
          type: 'monthly',
          pattern: monthlyPattern,
          confidence: monthlyPattern.confidence,
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze weekly pattern
   */
  private analyzeWeeklyPattern(predictions: any[]): any {
    const weeklyData = Array(7)
      .fill(null)
      .map(() => []);

    predictions.forEach(pred => {
      const dayOfWeek = moment(pred.predictionDate).day();
      weeklyData[dayOfWeek].push(pred.actualValue);
    });

    const weeklyAverages = weeklyData.map(dayData =>
      dayData.length > 0
        ? dayData.reduce((sum, val) => sum + val, 0) / dayData.length
        : 0,
    );

    const overallAverage =
      weeklyAverages.reduce((sum, avg) => sum + avg, 0) / 7;
    const variance =
      weeklyAverages.reduce(
        (sum, avg) => sum + Math.pow(avg - overallAverage, 2),
        0,
      ) / 7;
    const confidence =
      variance > 0 ? Math.min(Math.sqrt(variance) / overallAverage, 1) : 0;

    return {
      weeklyAverages,
      peakDay: weeklyAverages.indexOf(Math.max(...weeklyAverages)),
      lowDay: weeklyAverages.indexOf(Math.min(...weeklyAverages)),
      confidence,
    };
  }

  /**
   * Analyze monthly pattern
   */
  private analyzeMonthlyPattern(predictions: any[]): any {
    const monthlyData = Array(31)
      .fill(null)
      .map(() => []);

    predictions.forEach(pred => {
      const dayOfMonth = moment(pred.predictionDate).date() - 1; // 0-indexed
      if (dayOfMonth < 31) {
        monthlyData[dayOfMonth].push(pred.actualValue);
      }
    });

    const monthlyAverages = monthlyData.map(dayData =>
      dayData.length > 0
        ? dayData.reduce((sum, val) => sum + val, 0) / dayData.length
        : 0,
    );

    const validAverages = monthlyAverages.filter(avg => avg > 0);
    if (validAverages.length < 10) {
      return { confidence: 0 };
    }

    const overallAverage =
      validAverages.reduce((sum, avg) => sum + avg, 0) / validAverages.length;
    const variance =
      validAverages.reduce(
        (sum, avg) => sum + Math.pow(avg - overallAverage, 2),
        0,
      ) / validAverages.length;
    const confidence =
      variance > 0 ? Math.min(Math.sqrt(variance) / overallAverage, 1) : 0;

    return {
      monthlyAverages,
      peakDays: monthlyAverages
        .map((avg, index) => ({ day: index + 1, value: avg }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
        .map(item => item.day),
      confidence,
    };
  }

  /**
   * Detect behavioral shifts
   */
  private async detectBehavioralShifts(
    request: CulturalLearningRequest,
    historicalData: any,
  ): Promise<any[]> {
    const shifts = [];

    // Compare recent period with historical baseline
    const recentPeriod = moment(historicalData.timeRange.endDate)
      .subtract(3, 'months')
      .toDate();

    for (const [
      productId,
      predictions,
    ] of historicalData.productGroups.entries()) {
      const recentData = predictions.filter(
        pred => pred.predictionDate >= recentPeriod,
      );
      const historicalData_filtered = predictions.filter(
        pred => pred.predictionDate < recentPeriod,
      );

      if (recentData.length < 10 || historicalData_filtered.length < 10)
        continue;

      const recentAvg =
        recentData.reduce((sum, pred) => sum + pred.actualValue, 0) /
        recentData.length;
      const historicalAvg =
        historicalData_filtered.reduce(
          (sum, pred) => sum + pred.actualValue,
          0,
        ) / historicalData_filtered.length;

      const change = (recentAvg - historicalAvg) / historicalAvg;

      if (Math.abs(change) > 0.15) {
        // 15% change threshold
        shifts.push({
          productId,
          type: 'demand_level_shift',
          magnitude: Math.abs(change),
          direction: change > 0 ? 'increase' : 'decrease',
          recentAverage: recentAvg,
          historicalAverage: historicalAvg,
          confidence: Math.min(Math.abs(change) * 2, 1),
          detectedAt: new Date(),
        });
      }
    }

    return shifts;
  }

  /**
   * Create pattern from anomaly
   */
  private async createPatternFromAnomaly(
    tenantId: string,
    anomaly: any,
  ): Promise<LearnedCulturalPattern | null> {
    const patternId = `anomaly_${anomaly.productId}_${moment(
      anomaly.date,
    ).format('YYYY-MM-DD')}`;

    return {
      patternId,
      tenantId,
      discoveredAt: new Date(),
      lastUpdated: new Date(),
      patternName: `${
        anomaly.type === 'spike' ? 'Demand Spike' : 'Demand Drop'
      } - ${moment(anomaly.date).format('MMM DD')}`,
      description: `Unusual ${anomaly.type} detected on ${moment(
        anomaly.date,
      ).format('YYYY-MM-DD')} with ${anomaly.significance.toFixed(
        2,
      )} significance`,
      category: {
        primary: 'behavioral',
        secondary: ['anomaly'],
        tags: [anomaly.type, 'statistical_detection'],
      },
      strength: anomaly.significance,
      stability: 0.5, // Anomalies are inherently unstable
      triggerConditions: [
        {
          conditionId: 'anomaly_threshold',
          type: 'external_factor',
          description: 'Statistical anomaly threshold exceeded',
          confidence: anomaly.significance,
        },
      ],
      impactProfile: {
        demandMultiplier: anomaly.value / anomaly.expectedValue,
        varianceRange: [0.8, 1.5],
        affectedProducts: [
          {
            productId: anomaly.productId,
            impactStrength: anomaly.significance,
            confidence: anomaly.significance,
            correlationCoefficient: 0.8,
            elasticity: 1.2,
          },
        ],
        regionalVariation: [],
        demographicInfluence: [],
        channelEffects: [],
      },
      temporalCharacteristics: {
        frequency: {
          type: 'irregular',
          regularity: 0.1,
        },
        duration: {
          averageDays: 1,
          varianceDays: 0.5,
          buildupDays: 0,
          decayDays: 1,
        },
        timing: {
          preferredTimeOfDay: [],
          preferredDaysOfWeek: [],
          preferredDaysOfMonth: [],
          timezoneSensitive: false,
        },
        seasonality: {
          hasSeasonality: false,
          peakMonths: [],
          lowMonths: [],
        },
      },
      discoveryMethod: 'anomaly_detection',
      trainingAccuracy: anomaly.significance,
      validationAccuracy: 0.7,
      sampleSize: 1,
      evolutionHistory: [],
      trendDirection: 'emerging',
      businessRelevance: {
        revenueImpact:
          (Math.abs(anomaly.value - anomaly.expectedValue) /
            anomaly.expectedValue) *
          10,
        riskLevel: anomaly.significance > 0.8 ? 'high' : 'medium',
        strategicImportance: 'medium',
        implementationComplexity: 'simple',
        timeToValue: 1,
      },
      actionableInsights: [
        {
          insightId: `insight_${patternId}`,
          category: 'operations',
          title: `Monitor for ${anomaly.type} recurrence`,
          description: `Set up monitoring for similar ${anomaly.type} patterns`,
          recommendation: `Implement early warning system for ${anomaly.type} detection`,
          expectedBenefit: 'Improved demand forecasting accuracy',
          implementationSteps: [
            {
              stepId: 'monitoring_setup',
              description: 'Configure anomaly detection alerts',
              owner: 'operations_team',
              estimatedDays: 2,
              dependencies: [],
              deliverables: ['Alert configuration', 'Monitoring dashboard'],
            },
          ],
          resources: [
            {
              type: 'staff',
              amount: 0.5,
              unit: 'person-days',
              justification: 'Setup and configuration',
            },
          ],
          timeline: {
            preparationDays: 1,
            implementationDays: 2,
            measurementDays: 7,
            totalDays: 10,
          },
          kpiMetrics: [
            {
              metricName: 'Anomaly Detection Rate',
              targetValue: 0.9,
              unit: 'ratio',
              measurementMethod: 'Automated monitoring',
            },
          ],
        },
      ],
      integrationStatus: 'candidate',
    };
  }

  /**
   * Create pattern from correlation
   */
  private async createPatternFromCorrelation(
    tenantId: string,
    correlation: any,
  ): Promise<LearnedCulturalPattern | null> {
    const patternId = `correlation_${
      correlation.productId
    }_${correlation.eventName.replace(/\s+/g, '_')}`;

    return {
      patternId,
      tenantId,
      discoveredAt: new Date(),
      lastUpdated: new Date(),
      patternName: `${correlation.eventName} Impact Pattern`,
      description: `${correlation.direction} correlation between ${correlation.eventName} and demand`,
      category: {
        primary: 'cultural',
        secondary: [correlation.eventType],
        tags: ['correlation', 'cultural_event'],
      },
      strength: correlation.strength,
      stability: 0.8,
      triggerConditions: [
        {
          conditionId: 'cultural_event',
          type: 'cultural_event',
          description: correlation.eventName,
          confidence: correlation.strength,
        },
      ],
      impactProfile: {
        demandMultiplier:
          1 +
          (correlation.direction === 'positive'
            ? correlation.magnitude
            : -correlation.magnitude),
        varianceRange: [0.9, 1.1],
        affectedProducts: [
          {
            productId: correlation.productId,
            impactStrength: correlation.strength,
            confidence: correlation.strength,
            correlationCoefficient:
              correlation.direction === 'positive'
                ? correlation.strength
                : -correlation.strength,
            elasticity: 1.0,
          },
        ],
        regionalVariation: [],
        demographicInfluence: [],
        channelEffects: [],
      },
      temporalCharacteristics: {
        frequency: {
          type: 'annual',
          regularity: 0.9,
        },
        duration: {
          averageDays: 7,
          varianceDays: 2,
          buildupDays: 3,
          decayDays: 4,
        },
        timing: {
          preferredTimeOfDay: [],
          preferredDaysOfWeek: [],
          preferredDaysOfMonth: [],
          timezoneSensitive: true,
        },
        seasonality: {
          hasSeasonality: true,
          seasonalPeriod: 365,
          seasonalStrength: correlation.strength,
          peakMonths: [moment(correlation.eventDate).month() + 1],
          lowMonths: [],
        },
      },
      discoveryMethod: 'correlation_analysis',
      trainingAccuracy: correlation.strength,
      validationAccuracy: 0.75,
      sampleSize: correlation.sampleSize,
      evolutionHistory: [],
      trendDirection: 'stable',
      businessRelevance: {
        revenueImpact: correlation.magnitude * 20,
        riskLevel: 'low',
        strategicImportance: correlation.strength > 0.7 ? 'high' : 'medium',
        implementationComplexity: 'moderate',
        timeToValue: 7,
      },
      actionableInsights: [
        {
          insightId: `insight_${patternId}`,
          category: 'inventory',
          title: `Prepare for ${correlation.eventName}`,
          description: `Adjust inventory levels based on ${correlation.eventName} correlation`,
          recommendation: `${
            correlation.direction === 'positive' ? 'Increase' : 'Decrease'
          } inventory by ${(correlation.magnitude * 100).toFixed(0)}%`,
          expectedBenefit: `Improved inventory turnover and reduced stockouts/overstock`,
          implementationSteps: [
            {
              stepId: 'inventory_adjustment',
              description: 'Adjust inventory levels based on pattern',
              owner: 'inventory_manager',
              estimatedDays: 5,
              dependencies: [],
              deliverables: ['Inventory plan', 'Purchase orders'],
            },
          ],
          resources: [
            {
              type: 'budget',
              amount: correlation.magnitude * 10000,
              unit: 'IDR',
              justification: 'Additional inventory investment',
            },
          ],
          timeline: {
            preparationDays: 3,
            implementationDays: 5,
            measurementDays: 14,
            totalDays: 22,
          },
          kpiMetrics: [
            {
              metricName: 'Inventory Turnover',
              targetValue: 1.2,
              unit: 'ratio',
              measurementMethod: 'Sales/Inventory tracking',
            },
          ],
        },
      ],
      integrationStatus: 'candidate',
    };
  }

  /**
   * Create pattern from temporal analysis
   */
  private async createPatternFromTemporal(
    tenantId: string,
    tempPattern: any,
  ): Promise<LearnedCulturalPattern | null> {
    const patternId = `temporal_${tempPattern.productId}_${tempPattern.type}`;

    return {
      patternId,
      tenantId,
      discoveredAt: new Date(),
      lastUpdated: new Date(),
      patternName: `${
        tempPattern.type.charAt(0).toUpperCase() + tempPattern.type.slice(1)
      } Pattern`,
      description: `Regular ${tempPattern.type} demand pattern`,
      category: {
        primary: 'temporal',
        secondary: [tempPattern.type],
        tags: ['temporal', 'cyclic'],
      },
      strength: tempPattern.confidence,
      stability: 0.85,
      triggerConditions: [
        {
          conditionId: 'temporal_trigger',
          type: 'temporal',
          description: `${tempPattern.type} cycle`,
          confidence: tempPattern.confidence,
        },
      ],
      impactProfile: {
        demandMultiplier: 1.1,
        varianceRange: [0.95, 1.25],
        affectedProducts: [
          {
            productId: tempPattern.productId,
            impactStrength: tempPattern.confidence,
            confidence: tempPattern.confidence,
            correlationCoefficient: 0.7,
            elasticity: 1.0,
          },
        ],
        regionalVariation: [],
        demographicInfluence: [],
        channelEffects: [],
      },
      temporalCharacteristics: {
        frequency: {
          type: tempPattern.type === 'weekly' ? 'weekly' : 'monthly',
          regularity: tempPattern.confidence,
        },
        duration: {
          averageDays: tempPattern.type === 'weekly' ? 1 : 3,
          varianceDays: 1,
          buildupDays: 0,
          decayDays: 1,
        },
        timing: {
          preferredTimeOfDay: [],
          preferredDaysOfWeek:
            tempPattern.type === 'weekly' ? [tempPattern.pattern.peakDay] : [],
          preferredDaysOfMonth:
            tempPattern.type === 'monthly' ? tempPattern.pattern.peakDays : [],
          timezoneSensitive: false,
        },
        seasonality: {
          hasSeasonality: true,
          seasonalPeriod: tempPattern.type === 'weekly' ? 7 : 30,
          seasonalStrength: tempPattern.confidence,
          peakMonths: [],
          lowMonths: [],
        },
      },
      discoveryMethod: 'statistical',
      trainingAccuracy: tempPattern.confidence,
      validationAccuracy: 0.8,
      sampleSize: 30,
      evolutionHistory: [],
      trendDirection: 'stable',
      businessRelevance: {
        revenueImpact: 5,
        riskLevel: 'low',
        strategicImportance: 'medium',
        implementationComplexity: 'simple',
        timeToValue: 3,
      },
      actionableInsights: [
        {
          insightId: `insight_${patternId}`,
          category: 'operations',
          title: `Optimize ${tempPattern.type} operations`,
          description: `Adjust operations based on ${tempPattern.type} patterns`,
          recommendation: `Schedule peak capacity on ${
            tempPattern.type === 'weekly' ? 'peak days' : 'peak dates'
          }`,
          expectedBenefit: 'Improved operational efficiency',
          implementationSteps: [
            {
              stepId: 'schedule_optimization',
              description: 'Optimize staffing and capacity schedules',
              owner: 'operations_manager',
              estimatedDays: 3,
              dependencies: [],
              deliverables: ['Optimized schedule', 'Capacity plan'],
            },
          ],
          resources: [
            {
              type: 'staff',
              amount: 1,
              unit: 'person-days',
              justification: 'Schedule optimization',
            },
          ],
          timeline: {
            preparationDays: 1,
            implementationDays: 3,
            measurementDays: 7,
            totalDays: 11,
          },
          kpiMetrics: [
            {
              metricName: 'Operational Efficiency',
              targetValue: 1.1,
              unit: 'ratio',
              measurementMethod: 'Performance tracking',
            },
          ],
        },
      ],
      integrationStatus: 'candidate',
    };
  }

  /**
   * Create pattern from behavioral shift
   */
  private async createPatternFromBehavioralShift(
    tenantId: string,
    shift: any,
  ): Promise<LearnedCulturalPattern | null> {
    const patternId = `shift_${shift.productId}_${shift.type}_${Date.now()}`;

    return {
      patternId,
      tenantId,
      discoveredAt: new Date(),
      lastUpdated: new Date(),
      patternName: `Behavioral Shift - ${shift.direction}`,
      description: `Significant ${shift.direction} in demand levels detected`,
      category: {
        primary: 'behavioral',
        secondary: ['shift'],
        tags: ['behavioral_change', 'trend'],
      },
      strength: shift.confidence,
      stability: 0.6, // Shifts are moderately stable
      triggerConditions: [
        {
          conditionId: 'demand_shift',
          type: 'social_trend',
          description: `Demand level ${shift.direction}`,
          confidence: shift.confidence,
        },
      ],
      impactProfile: {
        demandMultiplier: shift.recentAverage / shift.historicalAverage,
        varianceRange: [0.85, 1.3],
        affectedProducts: [
          {
            productId: shift.productId,
            impactStrength: shift.confidence,
            confidence: shift.confidence,
            correlationCoefficient: 0.8,
            elasticity: 1.1,
          },
        ],
        regionalVariation: [],
        demographicInfluence: [],
        channelEffects: [],
      },
      temporalCharacteristics: {
        frequency: {
          type: 'irregular',
          regularity: 0.3,
        },
        duration: {
          averageDays: 90, // Behavioral shifts last longer
          varianceDays: 30,
          buildupDays: 30,
          decayDays: 60,
        },
        timing: {
          preferredTimeOfDay: [],
          preferredDaysOfWeek: [],
          preferredDaysOfMonth: [],
          timezoneSensitive: false,
        },
        seasonality: {
          hasSeasonality: false,
          peakMonths: [],
          lowMonths: [],
        },
      },
      discoveryMethod: 'statistical',
      trainingAccuracy: shift.confidence,
      validationAccuracy: 0.65,
      sampleSize: 60,
      evolutionHistory: [],
      trendDirection: 'emerging',
      businessRelevance: {
        revenueImpact: shift.magnitude * 50,
        riskLevel: shift.magnitude > 0.3 ? 'high' : 'medium',
        strategicImportance: 'high',
        implementationComplexity: 'complex',
        timeToValue: 30,
      },
      actionableInsights: [
        {
          insightId: `insight_${patternId}`,
          category: 'strategic',
          title: `Adapt to behavioral shift`,
          description: `Strategic adaptation to changing demand patterns`,
          recommendation: `${
            shift.direction === 'increase' ? 'Scale up' : 'Scale down'
          } operations and inventory`,
          expectedBenefit: 'Aligned operations with new demand levels',
          implementationSteps: [
            {
              stepId: 'strategic_adjustment',
              description: 'Adjust business strategy based on shift',
              owner: 'strategy_team',
              estimatedDays: 14,
              dependencies: [],
              deliverables: [
                'Strategy adjustment plan',
                'Implementation roadmap',
              ],
            },
          ],
          resources: [
            {
              type: 'budget',
              amount: shift.magnitude * 50000,
              unit: 'IDR',
              justification: 'Strategic adjustment investment',
            },
          ],
          timeline: {
            preparationDays: 7,
            implementationDays: 14,
            measurementDays: 30,
            totalDays: 51,
          },
          kpiMetrics: [
            {
              metricName: 'Demand Alignment',
              targetValue: 0.9,
              unit: 'ratio',
              measurementMethod: 'Forecast vs Actual tracking',
            },
          ],
        },
      ],
      integrationStatus: 'testing',
    };
  }

  /**
   * Update existing patterns with new data
   */
  private async updateExistingPatterns(
    request: CulturalLearningRequest,
    historicalData: any,
  ): Promise<LearnedCulturalPattern[]> {
    const updatedPatterns: LearnedCulturalPattern[] = [];

    for (const [patternId, pattern] of this.learnedPatterns.entries()) {
      if (pattern.tenantId !== request.tenantId) continue;

      // Update pattern with new data
      const updatedPattern = await this.updatePattern(pattern, historicalData);
      if (updatedPattern) {
        this.learnedPatterns.set(patternId, updatedPattern);
        updatedPatterns.push(updatedPattern);
      }
    }

    return updatedPatterns;
  }

  /**
   * Update a single pattern with new data
   */
  private async updatePattern(
    pattern: LearnedCulturalPattern,
    historicalData: any,
  ): Promise<LearnedCulturalPattern | null> {
    // Calculate new metrics based on recent data
    const recentAccuracy = await this.calculatePatternAccuracy(
      pattern,
      historicalData,
    );

    if (recentAccuracy < 0.3) {
      // Pattern performance has degraded significantly
      pattern.integrationStatus = 'deprecated';
      pattern.trendDirection = 'declining';
    } else if (recentAccuracy > pattern.validationAccuracy) {
      // Pattern has improved
      pattern.validationAccuracy = recentAccuracy;
      pattern.trendDirection = 'strengthening';
    }

    // Update evolution history
    pattern.evolutionHistory.push({
      timestamp: new Date(),
      version: `${pattern.evolutionHistory.length + 1}.0`,
      changes: [
        {
          changeType:
            recentAccuracy > pattern.validationAccuracy
              ? 'strength_increase'
              : 'strength_decrease',
          description: `Accuracy changed from ${pattern.validationAccuracy.toFixed(
            3,
          )} to ${recentAccuracy.toFixed(3)}`,
          magnitude: Math.abs(recentAccuracy - pattern.validationAccuracy),
          confidence: 0.8,
          evidenceSources: ['historical_data_analysis'],
        },
      ],
      performanceMetrics: {
        accuracyChange: recentAccuracy - pattern.validationAccuracy,
        predictionImprovement: 0.05,
        businessImpactChange: 0.02,
        adaptationSpeed: 0.8,
      },
    });

    pattern.lastUpdated = new Date();
    pattern.validationAccuracy = recentAccuracy;

    return pattern;
  }

  /**
   * Calculate pattern accuracy
   */
  private async calculatePatternAccuracy(
    pattern: LearnedCulturalPattern,
    historicalData: any,
  ): Promise<number> {
    // Simplified accuracy calculation
    // In a real implementation, this would involve complex ML evaluation

    const affectedProducts = pattern.impactProfile.affectedProducts;
    let totalAccuracy = 0;
    let count = 0;

    for (const productImpact of affectedProducts) {
      if (!productImpact.productId) continue;

      const productPredictions = historicalData.productGroups.get(
        productImpact.productId,
      );
      if (!productPredictions || productPredictions.length < 10) continue;

      // Calculate how well the pattern predicts actual values
      const predictions = productPredictions.slice(-30); // Last 30 predictions
      let correct = 0;

      predictions.forEach(pred => {
        const expectedMultiplier = pattern.impactProfile.demandMultiplier;
        const actualMultiplier =
          pred.actualValue / (pred.predictedValue || pred.actualValue);

        if (Math.abs(actualMultiplier - expectedMultiplier) < 0.2) {
          // 20% tolerance
          correct++;
        }
      });

      const accuracy = correct / predictions.length;
      totalAccuracy += accuracy;
      count++;
    }

    return count > 0 ? totalAccuracy / count : 0.5;
  }

  /**
   * Identify deprecated patterns
   */
  private async identifyDeprecatedPatterns(
    request: CulturalLearningRequest,
    historicalData: any,
  ): Promise<string[]> {
    const deprecatedPatterns: string[] = [];

    for (const [patternId, pattern] of this.learnedPatterns.entries()) {
      if (pattern.tenantId !== request.tenantId) continue;

      // Check if pattern is no longer relevant
      const daysSinceUpdate = moment().diff(
        moment(pattern.lastUpdated),
        'days',
      );
      const accuracy = await this.calculatePatternAccuracy(
        pattern,
        historicalData,
      );

      if (daysSinceUpdate > 180 || accuracy < 0.2) {
        // 6 months old or very low accuracy
        deprecatedPatterns.push(patternId);
        this.learnedPatterns.delete(patternId);
      }
    }

    return deprecatedPatterns;
  }

  /**
   * Assess pattern quality
   */
  private async assessPatternQuality(
    newPatterns: LearnedCulturalPattern[],
    updatedPatterns: LearnedCulturalPattern[],
  ): Promise<QualityAssessment> {
    const allPatterns = [...newPatterns, ...updatedPatterns];

    if (allPatterns.length === 0) {
      return {
        dataQualityScore: 50,
        patternReliabilityScore: 50,
        businessRelevanceScore: 50,
        implementabilityScore: 50,
        overallQualityScore: 50,
        qualityIssues: [
          {
            issueType: 'insufficient_data',
            severity: 'medium',
            description: 'No patterns available for assessment',
            recommendedAction: 'Collect more historical data',
          },
        ],
      };
    }

    const avgStrength =
      allPatterns.reduce((sum, p) => sum + p.strength, 0) / allPatterns.length;
    const avgStability =
      allPatterns.reduce((sum, p) => sum + p.stability, 0) / allPatterns.length;
    const avgBusinessRelevance =
      allPatterns.reduce(
        (sum, p) => sum + p.businessRelevance.revenueImpact,
        0,
      ) / allPatterns.length;
    const avgImplementability =
      allPatterns.filter(
        p => p.businessRelevance.implementationComplexity === 'simple',
      ).length / allPatterns.length;

    return {
      dataQualityScore: Math.round(avgStrength * 100),
      patternReliabilityScore: Math.round(avgStability * 100),
      businessRelevanceScore: Math.round(Math.min(avgBusinessRelevance, 100)),
      implementabilityScore: Math.round(avgImplementability * 100),
      overallQualityScore: Math.round(
        (avgStrength +
          avgStability +
          Math.min(avgBusinessRelevance / 100, 1) +
          avgImplementability) *
          25,
      ),
      qualityIssues: [],
    };
  }

  /**
   * Calculate learning metrics
   */
  private calculateLearningMetrics(
    newPatterns: LearnedCulturalPattern[],
    updatedPatterns: LearnedCulturalPattern[],
    deprecatedPatterns: string[],
  ): LearningMetrics {
    const totalActive = this.learnedPatterns.size;
    const avgStrength =
      totalActive > 0
        ? Array.from(this.learnedPatterns.values()).reduce(
            (sum, p) => sum + p.strength,
            0,
          ) / totalActive
        : 0;

    return {
      totalPatternsAnalyzed: totalActive + deprecatedPatterns.length,
      newPatternsDiscovered: newPatterns.length,
      patternsUpdated: updatedPatterns.length,
      patternsDeprecated: deprecatedPatterns.length,
      averagePatternStrength: avgStrength,
      learningAccuracy: 0.75, // Simplified
      predictionImprovement: newPatterns.length > 0 ? 0.1 : 0,
    };
  }

  /**
   * Integrate patterns into ML system
   */
  private async integratePatterns(
    newPatterns: LearnedCulturalPattern[],
    updatedPatterns: LearnedCulturalPattern[],
  ): Promise<IntegrationResult[]> {
    const results: IntegrationResult[] = [];

    // Integrate new patterns
    for (const pattern of newPatterns) {
      this.learnedPatterns.set(pattern.patternId, pattern);

      results.push({
        patternId: pattern.patternId,
        integrationStatus: 'success',
        integrationDetails: 'New pattern successfully integrated',
        performanceChange: pattern.strength * 0.1,
        businessImpactChange: pattern.businessRelevance.revenueImpact * 0.01,
        issues: [],
      });
    }

    // Integrate updated patterns
    for (const pattern of updatedPatterns) {
      results.push({
        patternId: pattern.patternId,
        integrationStatus: 'success',
        integrationDetails: 'Pattern successfully updated',
        performanceChange: 0.05,
        businessImpactChange: 0.02,
        issues: [],
      });
    }

    return results;
  }

  /**
   * Assess performance impact
   */
  private async assessPerformanceImpact(
    request: CulturalLearningRequest,
    integrationResults: IntegrationResult[],
  ): Promise<PerformanceImpact> {
    const avgPerformanceChange =
      integrationResults.length > 0
        ? integrationResults.reduce((sum, r) => sum + r.performanceChange, 0) /
          integrationResults.length
        : 0;

    const avgBusinessChange =
      integrationResults.length > 0
        ? integrationResults.reduce(
            (sum, r) => sum + r.businessImpactChange,
            0,
          ) / integrationResults.length
        : 0;

    return {
      overallAccuracyChange: avgPerformanceChange,
      predictionLatencyChange: 0, // Minimal impact on latency
      businessMetricImprovements: [
        {
          metric: 'Forecast Accuracy',
          improvementPercentage: avgPerformanceChange * 100,
          confidence: 0.7,
          measurementPeriod: '30 days',
        },
        {
          metric: 'Revenue Optimization',
          improvementPercentage: avgBusinessChange * 100,
          confidence: 0.6,
          measurementPeriod: '90 days',
        },
      ],
      resourceConsumptionChange: 0.05, // Slight increase due to additional processing
    };
  }

  /**
   * Generate learning recommendations
   */
  private async generateLearningRecommendations(
    request: CulturalLearningRequest,
    newPatterns: LearnedCulturalPattern[],
    updatedPatterns: LearnedCulturalPattern[],
    qualityAssessment: QualityAssessment,
  ): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];

    // Enhanced: Use business context enrichment for contextual recommendations
    try {
      const enrichmentRequest = {
        tenantId: request.tenantId,
        timeframe: {
          startDate: request.learningPeriod.startDate,
          endDate: request.learningPeriod.endDate,
        },
        analysisLevel: 'advanced' as const,
        includePatterns: [
          {
            patternType: 'cultural' as const,
            enabled: true,
            depth: 'deep' as const,
            historicalPeriod: 12,
            confidenceThreshold: 0.7,
          },
          {
            patternType: 'seasonal' as const,
            enabled: true,
            depth: 'medium' as const,
            historicalPeriod: 24,
            confidenceThreshold: 0.6,
          },
        ],
        contextScope: {
          geographic: 'national' as const,
          demographic: 'all' as const,
          temporal: 'predictive' as const,
          competitive: 'category' as const,
        },
        indonesianSettings: {
          primaryRegion: 'WIB' as const,
          culturalSensitivity: 'advanced' as const,
          religiousConsiderations: true,
          regionalVariations: true,
          languagePreference: 'bahasa' as const,
          businessSize: 'small' as const,
          industryVertical: {
            primary: 'retail' as const,
            secondary: ['food_beverage', 'fashion'],
            specializations: ['inventory_management'],
            regulatoryFramework: ['UU_PDP'],
          },
        },
      };

      const businessContext =
        await this.businessContextService.enrichBusinessContext(
          enrichmentRequest,
        );

      // Generate context-aware recommendations based on business enrichment
      if (businessContext.culturalPatterns.length > 0) {
        const upcomingCulturalEvents = businessContext.culturalPatterns.filter(
          pattern => pattern.strength > 0.8,
        );

        if (upcomingCulturalEvents.length > 0) {
          recommendations.push({
            recommendationType: 'business_action',
            title: 'Prepare for Upcoming Cultural Events',
            description: `[Cultural Context] Detected ${upcomingCulturalEvents.length} high-impact cultural events approaching. Consider pattern-based inventory adjustments.`,
            priority: 'high',
            estimatedBenefit:
              'Optimized inventory levels and reduced stockouts during cultural events',
            implementationGuide: `Focus on patterns: ${upcomingCulturalEvents
              .map(p => p.name)
              .join(
                ', ',
              )}. Suggested demand multipliers: ${upcomingCulturalEvents
              .map(p => p.demandMultiplier.toFixed(1))
              .join(', ')}`,
          });
        }
      }

      // Indonesian market-specific recommendations
      if (businessContext.confidence > 0.8) {
        recommendations.push({
          recommendationType: 'model_adjustment',
          title: 'Indonesian Market Pattern Optimization',
          description:
            '[Indonesian Context] High-confidence Indonesian business context detected. Apply local market patterns for better predictions.',
          priority: 'medium',
          estimatedBenefit:
            'Improved prediction accuracy for Indonesian market conditions',
          implementationGuide:
            'Integrate detected regional variations and cultural sensitivity factors into forecasting models',
        });
      }

      // Risk-based recommendations from business context
      if (businessContext.riskFactors.length > 0) {
        const highRiskFactors = businessContext.riskFactors.filter(
          risk => risk.riskScore > 0.7,
        );
        if (highRiskFactors.length > 0) {
          recommendations.push({
            recommendationType: 'pattern_investigation',
            title: 'Address High-Risk Market Factors',
            description: `[Risk Analysis] ${highRiskFactors.length} high-risk factors identified that may affect pattern reliability.`,
            priority: 'high',
            estimatedBenefit:
              'Reduced prediction errors and improved pattern stability',
            implementationGuide: `Monitor and adjust for: ${highRiskFactors
              .map(r => r.name)
              .join(', ')}`,
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Business context enrichment failed: ${error.message}. Falling back to basic recommendations.`,
      );
    }

    // Original basic recommendations (unchanged)
    if (newPatterns.length === 0) {
      recommendations.push({
        recommendationType: 'data_collection',
        title: 'Increase Data Collection',
        description:
          'No new patterns discovered. Consider increasing data collection scope or depth.',
        priority: 'medium',
        estimatedBenefit: 'Better pattern discovery capability',
        implementationGuide:
          'Extend historical data collection period or include additional data sources',
      });
    }

    if (qualityAssessment.overallQualityScore < 70) {
      recommendations.push({
        recommendationType: 'model_adjustment',
        title: 'Improve Pattern Quality',
        description:
          'Pattern quality is below optimal threshold. Adjust learning algorithms.',
        priority: 'high',
        estimatedBenefit: 'Higher quality patterns and better predictions',
        implementationGuide:
          'Fine-tune pattern discovery algorithms and validation criteria',
      });
    }

    const highBusinessImpactPatterns = [
      ...newPatterns,
      ...updatedPatterns,
    ].filter(p => p.businessRelevance.strategicImportance === 'high');

    if (highBusinessImpactPatterns.length > 0) {
      recommendations.push({
        recommendationType: 'business_action',
        title: 'Prioritize High-Impact Patterns',
        description: `${highBusinessImpactPatterns.length} high-impact patterns identified for immediate implementation`,
        priority: 'high',
        estimatedBenefit: 'Significant business impact and ROI',
        implementationGuide:
          'Create implementation plan for high-impact patterns',
      });
    }

    return recommendations;
  }

  /**
   * Generate suggested actions
   */
  private generateSuggestedActions(
    learningMetrics: LearningMetrics,
    qualityAssessment: QualityAssessment,
    performanceImpact: PerformanceImpact,
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (learningMetrics.newPatternsDiscovered > 0) {
      actions.push({
        actionType: 'immediate',
        category: 'implementation',
        description: 'Review and implement newly discovered patterns',
        expectedOutcome:
          'Improved prediction accuracy and business performance',
        priority: 8,
      });
    }

    if (qualityAssessment.overallQualityScore > 80) {
      actions.push({
        actionType: 'short_term',
        category: 'optimization',
        description: 'Expand pattern learning to additional product categories',
        expectedOutcome: 'Broader coverage and more comprehensive insights',
        priority: 6,
      });
    }

    if (performanceImpact.overallAccuracyChange > 0.05) {
      actions.push({
        actionType: 'immediate',
        category: 'monitoring',
        description:
          'Monitor performance improvements from pattern integration',
        expectedOutcome: 'Validated business benefits and ROI measurement',
        priority: 7,
      });
    }

    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Scheduled pattern learning - runs weekly
   */
  @Cron('0 2 * * 0') // Every Sunday at 2 AM
  async scheduledPatternLearning(): Promise<void> {
    this.logger.log('Running scheduled cultural pattern learning');

    try {
      // Get all active tenants (simplified - in real implementation would query tenant table)
      const activeTenants = ['default_tenant']; // Placeholder

      for (const tenantId of activeTenants) {
        try {
          const request: CulturalLearningRequest = {
            tenantId,
            learningPeriod: {
              startDate: moment().subtract(6, 'months').toDate(),
              endDate: new Date(),
              trainingWindow: 6,
              validationWindow: 1,
              minDataPoints: 30,
            },
            analysisDepth: 'advanced',
            includeRegionalVariations: true,
            includeBehavioralShifts: true,
          };

          await this.performCulturalLearning(request);
        } catch (error) {
          this.logger.error(
            `Scheduled learning failed for tenant ${tenantId}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Scheduled pattern learning failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get learned patterns for a tenant
   */
  async getLearnedPatterns(
    tenantId: string,
  ): Promise<LearnedCulturalPattern[]> {
    return Array.from(this.learnedPatterns.values()).filter(
      pattern => pattern.tenantId === tenantId,
    );
  }

  /**
   * Get pattern by ID
   */
  async getPattern(patternId: string): Promise<LearnedCulturalPattern | null> {
    return this.learnedPatterns.get(patternId) || null;
  }

  /**
   * Health check for pattern learning system
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    totalPatterns: number;
    activePatterns: number;
    avgQuality: number;
    lastUpdate: Date;
  }> {
    const totalPatterns = this.learnedPatterns.size;
    const activePatterns = Array.from(this.learnedPatterns.values()).filter(
      p => p.integrationStatus === 'active',
    ).length;

    const avgQuality =
      totalPatterns > 0
        ? Array.from(this.learnedPatterns.values()).reduce(
            (sum, p) => sum + p.strength,
            0,
          ) / totalPatterns
        : 0;

    const lastUpdate =
      totalPatterns > 0
        ? new Date(
            Math.max(
              ...Array.from(this.learnedPatterns.values()).map(p =>
                p.lastUpdated.getTime(),
              ),
            ),
          )
        : new Date(0);

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (avgQuality < 0.5 || activePatterns < totalPatterns * 0.7) {
      status = 'degraded';
    }
    if (avgQuality < 0.3 || activePatterns < totalPatterns * 0.5) {
      status = 'critical';
    }

    return {
      status,
      totalPatterns,
      activePatterns,
      avgQuality,
      lastUpdate,
    };
  }
}
