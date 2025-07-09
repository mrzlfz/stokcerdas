import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseBoolPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/entities/user.entity';

import {
  PurchaseBehaviorAnalyzerService,
  EnhancedPurchaseFrequencyPattern as PurchaseFrequencyPattern,
  AdvancedSeasonalityPattern as SeasonalityPattern,
  IndonesianProductAffinityLevel as ProductAffinityLevel,
} from '../services/purchase-behavior-analyzer.service';

// Type aliases for return interfaces
type PurchaseFrequencyAnalysis = {
  customerId: string;
  frequencyPattern: PurchaseFrequencyPattern;
  averageDaysBetweenPurchases: number;
  purchaseConsistency: number;
  seasonalVariation: number;
  trendDirection: 'increasing' | 'stable' | 'decreasing';
  recommendations: string[];
  indonesianContext: {
    paymentCycleAlignment: boolean;
    ramadanFrequencyChange: number;
    culturalEventImpact: Record<string, number>;
  };
};

type SeasonalityAnalysis = {
  customerId: string;
  seasonalityPattern: SeasonalityPattern;
  monthlyTrends: Record<string, number>;
  culturalEventImpact: Record<
    string,
    {
      impactMultiplier: number;
      durationDays: number;
      preparationPeriod: number;
    }
  >;
  recommendations: string[];
  indonesianContext: {
    religiousCalendarAlignment: number;
    regionalSeasonalVariation: Record<string, number>;
  };
};

type ProductPreferenceAnalysis = {
  customerId: string;
  affinityLevel: ProductAffinityLevel;
  topCategories: Array<{
    category: string;
    affinityScore: number;
    purchaseFrequency: number;
  }>;
  brandLoyalty: Record<string, number>;
  priceSegmentPreference: 'budget' | 'mid-range' | 'premium' | 'luxury';
  recommendations: string[];
  indonesianContext: {
    halalPreference: boolean;
    localBrandSupport: number;
    traditionalProductAffinity: number;
  };
};

type PurchaseTimingAnalysis = {
  customerId: string;
  preferredDays: string[];
  preferredHours: number[];
  timeZonePattern: 'WIB' | 'WITA' | 'WIT';
  paymentCycleAlignment: boolean;
  recommendations: string[];
  indonesianContext: {
    prayerTimeConsideration: boolean;
    workingHoursPattern: string;
    weekendShoppingPreference: number;
  };
};

type BehaviorPredictionModel = {
  customerId: string;
  modelAccuracy: number;
  nextPurchasePrediction: {
    predictedDate: Date;
    confidence: number;
    estimatedValue: number;
    likelyCategories: string[];
  };
  behaviorRisk: {
    churnProbability: number;
    riskFactors: string[];
    mitigationStrategies: string[];
  };
  recommendations: string[];
  indonesianContext: {
    culturalEventAwareness: number;
    economicSensitivity: number;
    socialInfluence: number;
  };
};

@ApiTags('Purchase Behavior Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('customers/purchase-behavior')
export class PurchaseBehaviorController {
  private readonly logger = new Logger(PurchaseBehaviorController.name);

  constructor(
    private readonly purchaseBehaviorAnalyzerService: PurchaseBehaviorAnalyzerService,
  ) {}

  @Get('frequency-analysis/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Analyze customer purchase frequency patterns',
    description:
      'Get comprehensive analysis of customer purchase frequency including patterns, trends, and predictions with Indonesian business context',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase frequency analysis completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            frequencyPattern: {
              type: 'string',
              enum: Object.values(PurchaseFrequencyPattern),
              description: 'Classified purchase frequency pattern',
            },
            averageDaysBetweenPurchases: { type: 'number' },
            purchaseFrequencyScore: {
              type: 'number',
              minimum: 0,
              maximum: 100,
            },
            frequencyTrend: {
              type: 'string',
              enum: ['accelerating', 'stable', 'decelerating', 'irregular'],
            },
            frequencyConsistency: { type: 'number', minimum: 0, maximum: 100 },
            nextPurchasePrediction: {
              type: 'object',
              properties: {
                predictedDate: { type: 'string', format: 'date-time' },
                confidence: { type: 'number', minimum: 0, maximum: 100 },
                probabilityRange: {
                  type: 'object',
                  properties: {
                    earliest: { type: 'string', format: 'date-time' },
                    latest: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
            seasonalFrequencyVariation: { type: 'array' },
            channelFrequencyPreferences: { type: 'array' },
            frequencyCorrelationFactors: { type: 'object' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            tenantId: { type: 'string' },
            analysisType: { type: 'string', default: 'purchase_frequency' },
            calculatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid customer ID or insufficient purchase data',
  })
  async analyzePurchaseFrequency(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{
    success: boolean;
    data: PurchaseFrequencyAnalysis;
    meta: {
      customerId: string;
      tenantId: string;
      analysisType: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Analyzing purchase frequency for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const frequencyAnalysis =
        await this.purchaseBehaviorAnalyzerService.analyzePurchaseFrequency(
          user.tenantId,
          customerId,
        );

      return {
        success: true,
        data: frequencyAnalysis,
        meta: {
          customerId,
          tenantId: user.tenantId,
          analysisType: 'purchase_frequency',
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze purchase frequency for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('seasonality-analysis/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Analyze customer seasonality patterns',
    description:
      'Get comprehensive seasonality analysis including Indonesian cultural events, religious holidays, and weather patterns impact on purchase behavior',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Seasonality analysis completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            seasonalityStrength: { type: 'number', minimum: 0, maximum: 100 },
            dominantSeasonalPatterns: {
              type: 'array',
              items: {
                type: 'string',
                enum: Object.values(SeasonalityPattern),
              },
            },
            seasonalPurchaseBehavior: { type: 'array' },
            indonesianCulturalAlignment: {
              type: 'object',
              properties: {
                ramadanBehaviorPattern: { type: 'object' },
                religiousCelebrationImpact: { type: 'array' },
                nationalHolidayEffects: { type: 'array' },
              },
            },
            weatherPatternCorrelation: { type: 'object' },
            predictiveSeasonalPlanning: { type: 'array' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            tenantId: { type: 'string' },
            analysisType: { type: 'string', default: 'seasonality' },
            calculatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async analyzeSeasonality(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{
    success: boolean;
    data: SeasonalityAnalysis;
    meta: {
      customerId: string;
      tenantId: string;
      analysisType: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Analyzing seasonality patterns for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const seasonalityAnalysis =
        await this.purchaseBehaviorAnalyzerService.analyzeSeasonality(
          user.tenantId,
          customerId,
        );

      return {
        success: true,
        data: seasonalityAnalysis,
        meta: {
          customerId,
          tenantId: user.tenantId,
          analysisType: 'seasonality',
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze seasonality for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('product-preferences/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Analyze customer product preferences and affinity patterns',
    description:
      'Get comprehensive analysis of product preferences including category affinity, brand loyalty, cross-purchase patterns, and Indonesian product preferences',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product preference analysis completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            categoryAffinityProfile: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  affinityLevel: {
                    type: 'string',
                    enum: Object.values(ProductAffinityLevel),
                  },
                  spendingShare: { type: 'number' },
                  frequencyShare: { type: 'number' },
                  loyaltyScore: { type: 'number', minimum: 0, maximum: 100 },
                  priceElasticity: { type: 'number' },
                  brandConcentration: { type: 'object' },
                },
              },
            },
            crossPurchasePatterns: { type: 'array' },
            priceSegmentPreferences: { type: 'object' },
            productLifecycleAdoption: { type: 'object' },
            indonesianProductPreferences: { type: 'object' },
            upsellCrosssellOpportunities: { type: 'array' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            tenantId: { type: 'string' },
            analysisType: { type: 'string', default: 'product_preferences' },
            calculatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async analyzeProductPreferences(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{
    success: boolean;
    data: ProductPreferenceAnalysis;
    meta: {
      customerId: string;
      tenantId: string;
      analysisType: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Analyzing product preferences for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const productPreferenceAnalysis =
        await this.purchaseBehaviorAnalyzerService.analyzeProductPreferences(
          user.tenantId,
          customerId,
        );

      return {
        success: true,
        data: productPreferenceAnalysis,
        meta: {
          customerId,
          tenantId: user.tenantId,
          analysisType: 'product_preferences',
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze product preferences for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('purchase-timing/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Analyze customer purchase timing patterns',
    description:
      'Get comprehensive analysis of purchase timing including temporal patterns, decision-making speed, and Indonesian timing factors',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase timing analysis completed successfully',
  })
  async analyzePurchaseTiming(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{
    success: boolean;
    data: PurchaseTimingAnalysis;
    meta: {
      customerId: string;
      tenantId: string;
      analysisType: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Analyzing purchase timing for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const timingAnalysis =
        await this.purchaseBehaviorAnalyzerService.analyzePurchaseTiming(
          user.tenantId,
          customerId,
        );

      return {
        success: true,
        data: timingAnalysis,
        meta: {
          customerId,
          tenantId: user.tenantId,
          analysisType: 'purchase_timing',
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze purchase timing for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('behavior-prediction/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Generate comprehensive behavior prediction model',
    description:
      'Get predictive analytics for future purchase behavior including next purchase predictions, seasonal preparation needs, churn risk indicators, and growth opportunities',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Behavior prediction model generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            nextPurchasePredictions: { type: 'array' },
            seasonalPreparationNeeds: { type: 'array' },
            churnRiskIndicators: { type: 'object' },
            growthOpportunities: { type: 'object' },
            indonesianContextPredictions: { type: 'object' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            tenantId: { type: 'string' },
            analysisType: { type: 'string', default: 'behavior_prediction' },
            calculatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async generateBehaviorPredictionModel(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{
    success: boolean;
    data: BehaviorPredictionModel;
    meta: {
      customerId: string;
      tenantId: string;
      analysisType: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating behavior prediction model for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const behaviorPredictionModel =
        await this.purchaseBehaviorAnalyzerService.generateBehaviorPredictionModel(
          user.tenantId,
          customerId,
        );

      return {
        success: true,
        data: behaviorPredictionModel,
        meta: {
          customerId,
          tenantId: user.tenantId,
          analysisType: 'behavior_prediction',
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate behavior prediction model for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('comprehensive-analysis/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get comprehensive purchase behavior analysis (all components)',
    description:
      'Get complete purchase behavior analysis including frequency, seasonality, product preferences, timing, and behavior predictions in a single API call',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiQuery({
    name: 'includeFrequency',
    required: false,
    description: 'Include frequency analysis (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeSeasonality',
    required: false,
    description: 'Include seasonality analysis (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeProductPreferences',
    required: false,
    description: 'Include product preferences analysis (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeTiming',
    required: false,
    description: 'Include timing analysis (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includePredictions',
    required: false,
    description: 'Include behavior predictions (default: true)',
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Comprehensive purchase behavior analysis completed successfully',
  })
  async getComprehensivePurchaseBehaviorAnalysis(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query('includeFrequency', new DefaultValuePipe(true), ParseBoolPipe)
    includeFrequency: boolean,
    @Query('includeSeasonality', new DefaultValuePipe(true), ParseBoolPipe)
    includeSeasonality: boolean,
    @Query(
      'includeProductPreferences',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeProductPreferences: boolean,
    @Query('includeTiming', new DefaultValuePipe(true), ParseBoolPipe)
    includeTiming: boolean,
    @Query('includePredictions', new DefaultValuePipe(true), ParseBoolPipe)
    includePredictions: boolean,
  ): Promise<{
    success: boolean;
    data: {
      customerId: string;
      frequencyAnalysis?: PurchaseFrequencyAnalysis;
      seasonalityAnalysis?: SeasonalityAnalysis;
      productPreferenceAnalysis?: ProductPreferenceAnalysis;
      timingAnalysis?: PurchaseTimingAnalysis;
      behaviorPredictionModel?: BehaviorPredictionModel;
    };
    meta: {
      customerId: string;
      tenantId: string;
      analysisType: string;
      includedComponents: string[];
      calculatedAt: string;
      executionTime: number;
    };
  }> {
    const startTime = Date.now();
    this.logger.debug(
      `Getting comprehensive purchase behavior analysis for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const includedComponents: string[] = [];
      const analysisPromises: Promise<any>[] = [];

      // Build analysis requests based on query parameters
      if (includeFrequency) {
        includedComponents.push('frequency');
        analysisPromises.push(
          this.purchaseBehaviorAnalyzerService.analyzePurchaseFrequency(
            user.tenantId,
            customerId,
          ),
        );
      }

      if (includeSeasonality) {
        includedComponents.push('seasonality');
        analysisPromises.push(
          this.purchaseBehaviorAnalyzerService.analyzeSeasonality(
            user.tenantId,
            customerId,
          ),
        );
      }

      if (includeProductPreferences) {
        includedComponents.push('product_preferences');
        analysisPromises.push(
          this.purchaseBehaviorAnalyzerService.analyzeProductPreferences(
            user.tenantId,
            customerId,
          ),
        );
      }

      if (includeTiming) {
        includedComponents.push('timing');
        analysisPromises.push(
          this.purchaseBehaviorAnalyzerService.analyzePurchaseTiming(
            user.tenantId,
            customerId,
          ),
        );
      }

      if (includePredictions) {
        includedComponents.push('predictions');
        analysisPromises.push(
          this.purchaseBehaviorAnalyzerService.generateBehaviorPredictionModel(
            user.tenantId,
            customerId,
          ),
        );
      }

      if (analysisPromises.length === 0) {
        throw new BadRequestException(
          'At least one analysis component must be included',
        );
      }

      // Execute all requested analyses in parallel
      const results = await Promise.all(analysisPromises);

      // Map results to response structure
      const data: any = { customerId };
      let resultIndex = 0;

      if (includeFrequency) {
        data.frequencyAnalysis = results[resultIndex++];
      }

      if (includeSeasonality) {
        data.seasonalityAnalysis = results[resultIndex++];
      }

      if (includeProductPreferences) {
        data.productPreferenceAnalysis = results[resultIndex++];
      }

      if (includeTiming) {
        data.timingAnalysis = results[resultIndex++];
      }

      if (includePredictions) {
        data.behaviorPredictionModel = results[resultIndex++];
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data,
        meta: {
          customerId,
          tenantId: user.tenantId,
          analysisType: 'comprehensive_purchase_behavior',
          includedComponents,
          calculatedAt: new Date().toISOString(),
          executionTime,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get comprehensive purchase behavior analysis for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('analytics-summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get purchase behavior analytics summary for tenant',
    description:
      'Get aggregated purchase behavior insights across all customers for dashboard and reporting purposes',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of customers to analyze (default: 100, max: 500)',
    type: Number,
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description:
      'Include inactive customers (no purchase in 180+ days) (default: false)',
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase behavior analytics summary retrieved successfully',
  })
  async getPurchaseBehaviorAnalyticsSummary(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(100)) limit: number,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe)
    includeInactive: boolean,
  ): Promise<{
    success: boolean;
    data: {
      totalCustomersAnalyzed: number;
      frequencyPatternDistribution: Record<string, number>;
      seasonalityStrengthDistribution: {
        low: number; // 0-30
        medium: number; // 30-70
        high: number; // 70-100
      };
      topProductCategories: Array<{
        category: string;
        customerCount: number;
        averageAffinityScore: number;
      }>;
      averagePurchaseFrequency: number;
      nextWeekPredictedPurchases: number;
      churnRiskDistribution: {
        low: number;
        medium: number;
        high: number;
        critical: number;
      };
      indonesianContextInsights: {
        ramadanSensitiveCustomers: number;
        lebaranHighSpenders: number;
        localProductLoyalists: number;
        halalCertificationImportant: number;
      };
    };
    meta: {
      tenantId: string;
      analysisDate: string;
      customersIncluded: {
        active: number;
        inactive: number;
        total: number;
      };
      executionTime: number;
    };
  }> {
    const startTime = Date.now();
    this.logger.debug(
      `Getting purchase behavior analytics summary for tenant ${user.tenantId}`,
    );

    try {
      // Validate limit
      if (limit > 500) {
        throw new BadRequestException('Maximum limit is 500 customers');
      }

      // For now, return a structured mock response
      // In a real implementation, this would aggregate actual customer data
      const summary = {
        totalCustomersAnalyzed: Math.min(limit, 150),
        frequencyPatternDistribution: {
          [PurchaseFrequencyPattern.HYPER_FREQUENT]: 5,
          [PurchaseFrequencyPattern.FREQUENT]: 25,
          [PurchaseFrequencyPattern.REGULAR]: 45,
          [PurchaseFrequencyPattern.OCCASIONAL]: 35,
          [PurchaseFrequencyPattern.INFREQUENT]: 25,
          [PurchaseFrequencyPattern.RARE]: 10,
          [PurchaseFrequencyPattern.DORMANT]: includeInactive ? 15 : 0,
        },
        seasonalityStrengthDistribution: {
          low: 40, // 0-30 seasonality strength
          medium: 85, // 30-70 seasonality strength
          high: 25, // 70-100 seasonality strength
        },
        topProductCategories: [
          {
            category: 'Electronics',
            customerCount: 75,
            averageAffinityScore: 72,
          },
          { category: 'Fashion', customerCount: 68, averageAffinityScore: 65 },
          {
            category: 'Food & Beverage',
            customerCount: 92,
            averageAffinityScore: 78,
          },
          {
            category: 'Home & Garden',
            customerCount: 45,
            averageAffinityScore: 58,
          },
          {
            category: 'Health & Beauty',
            customerCount: 55,
            averageAffinityScore: 61,
          },
        ],
        averagePurchaseFrequency: 18.5, // days
        nextWeekPredictedPurchases: 45,
        churnRiskDistribution: {
          low: 80, // 0-40% risk
          medium: 45, // 40-70% risk
          high: 20, // 70-90% risk
          critical: 5, // 90%+ risk
        },
        indonesianContextInsights: {
          ramadanSensitiveCustomers: 85,
          lebaranHighSpenders: 60,
          localProductLoyalists: 95,
          halalCertificationImportant: 110,
        },
      };

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: summary,
        meta: {
          tenantId: user.tenantId,
          analysisDate: new Date().toISOString(),
          customersIncluded: {
            active: includeInactive ? 135 : 150,
            inactive: includeInactive ? 15 : 0,
            total: 150,
          },
          executionTime,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get purchase behavior analytics summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
