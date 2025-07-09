import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
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
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';

import { CustomerJourneyTrackingService } from '../services/customer-journey-tracking.service';
// ULTRATHINK: Updated imports to use shared enums from customer-enums.ts
import {
  CustomerJourneyType,
  CustomerJourneyChannel,
  CustomerJourneyStatus,
  TouchpointType,
  TouchpointStatus,
  InteractionType,
  InteractionStatus,
  InteractionSentiment,
} from '../entities/customer-enums';
import { TouchpointPriority } from '../entities/customer-touchpoint.entity'; // TouchpointPriority is unique to touchpoint

/**
 * ULTRATHINK: Customer Journey Tracking Controller
 * Comprehensive API for customer journey tracking with Indonesian business intelligence
 */
@ApiTags('Customer Journey Tracking')
@Controller('customer-journey-tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomerJourneyTrackingController {
  private readonly logger = new Logger(CustomerJourneyTrackingController.name);

  constructor(
    private readonly customerJourneyTrackingService: CustomerJourneyTrackingService,
  ) {}

  // =============================================
  // ULTRATHINK: JOURNEY MANAGEMENT ENDPOINTS
  // =============================================

  /**
   * Create new customer journey
   */
  @Post('journeys')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Create new customer journey',
    description:
      'Creates a new customer journey with Indonesian business context enrichment',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Journey created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid journey data',
  })
  async createCustomerJourney(
    @GetTenant() tenantId: string,
    @Body()
    createJourneyDto: {
      customerId: string;
      journeyType: CustomerJourneyType;
      primaryChannel: CustomerJourneyChannel;
      journeyName: string;
      journeyDescription?: string;
      journeyGoal?: string;
      sourceCampaign?: string;
      utmParameters?: any;
      deviceInfo?: any;
    },
  ) {
    try {
      const journey =
        await this.customerJourneyTrackingService.createCustomerJourney(
          tenantId,
          createJourneyDto.customerId,
          createJourneyDto,
        );

      return {
        success: true,
        data: journey,
        message: 'Customer journey created successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create customer journey: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Track customer touchpoint
   */
  @Post('touchpoints')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Track customer touchpoint',
    description:
      'Records a customer touchpoint with comprehensive analytics and Indonesian context',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Touchpoint tracked successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid touchpoint data',
  })
  async trackCustomerTouchpoint(
    @GetTenant() tenantId: string,
    @Body()
    trackTouchpointDto: {
      customerId: string;
      journeyId?: string;
      touchpointType: TouchpointType;
      channel: CustomerJourneyChannel;
      touchpointName: string;
      touchpointDescription?: string;
      pageUrl?: string;
      referrerUrl?: string;
      campaignData?: any;
      deviceInfo?: any;
      customAttributes?: Record<string, any>;
    },
  ) {
    try {
      const touchpoint =
        await this.customerJourneyTrackingService.trackCustomerTouchpoint(
          tenantId,
          trackTouchpointDto.customerId,
          trackTouchpointDto,
        );

      return {
        success: true,
        data: touchpoint,
        message: 'Customer touchpoint tracked successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to track touchpoint: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Record customer interaction
   */
  @Post('interactions')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Record customer interaction',
    description:
      'Records a detailed customer interaction with quality and sentiment analysis',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Interaction recorded successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid interaction data',
  })
  async recordCustomerInteraction(
    @GetTenant() tenantId: string,
    @Body()
    recordInteractionDto: {
      customerId: string;
      journeyId?: string;
      touchpointId?: string;
      interactionType: InteractionType;
      channel: CustomerJourneyChannel;
      interactionTitle: string;
      interactionDescription?: string;
      interactionContent?: string;
      userInput?: any;
      systemResponse?: any;
      contextualData?: any;
      businessContext?: any;
      customAttributes?: Record<string, any>;
    },
  ) {
    try {
      const interaction =
        await this.customerJourneyTrackingService.recordCustomerInteraction(
          tenantId,
          recordInteractionDto.customerId,
          recordInteractionDto,
        );

      return {
        success: true,
        data: interaction,
        message: 'Customer interaction recorded successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to record interaction: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  // =============================================
  // ULTRATHINK: ANALYTICS & INSIGHTS ENDPOINTS
  // =============================================

  /**
   * Generate comprehensive journey insights
   */
  @Get('journeys/:journeyId/insights')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Generate journey insights',
    description:
      'Generates comprehensive journey insights with Indonesian market analysis',
  })
  @ApiParam({ name: 'journeyId', description: 'Customer journey ID' })
  @ApiQuery({
    name: 'analysisDepth',
    enum: ['basic', 'standard', 'comprehensive'],
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Journey insights generated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Journey not found',
  })
  async generateJourneyInsights(
    @GetTenant() tenantId: string,
    @Param('journeyId') journeyId: string,
    @Query('analysisDepth')
    analysisDepth: 'basic' | 'standard' | 'comprehensive' = 'comprehensive',
  ) {
    try {
      // Convert analysisDepth string to options object
      const options = {
        includeIndonesianContext:
          analysisDepth === 'comprehensive' || analysisDepth === 'standard',
        includeCompetitorAnalysis: analysisDepth === 'comprehensive',
        timeRange: undefined, // Can be extended based on query params if needed
      };

      const insights =
        await this.customerJourneyTrackingService.generateCustomerJourneyInsights(
          tenantId,
          journeyId,
          options,
        );

      return {
        success: true,
        data: insights,
        message: 'Journey insights generated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate journey insights: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Analyze journey paths
   */
  @Get('analytics/journey-paths')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Analyze journey paths',
    description:
      'Analyzes customer journey paths with Indonesian business context patterns',
  })
  @ApiQuery({
    name: 'startDate',
    type: 'string',
    required: false,
    description: 'Analysis start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    type: 'string',
    required: false,
    description: 'Analysis end date (ISO string)',
  })
  @ApiQuery({
    name: 'journeyTypes',
    type: 'string',
    isArray: true,
    required: false,
    description: 'Journey types to analyze',
  })
  @ApiQuery({
    name: 'channels',
    type: 'string',
    isArray: true,
    required: false,
    description: 'Channels to analyze',
  })
  @ApiQuery({
    name: 'includeIndonesianContext',
    type: 'boolean',
    required: false,
    description: 'Include Indonesian context factors',
  })
  @ApiQuery({
    name: 'minPathFrequency',
    type: 'number',
    required: false,
    description: 'Minimum path frequency threshold',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Journey path analysis completed successfully',
  })
  async analyzeJourneyPaths(
    @GetTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('journeyTypes') journeyTypes?: CustomerJourneyType[],
    @Query('channels') channels?: CustomerJourneyChannel[],
    @Query('includeIndonesianContext') includeIndonesianContext?: boolean,
    @Query('minPathFrequency') minPathFrequency?: number,
  ) {
    try {
      const analysisConfig: any = {};

      if (startDate && endDate) {
        analysisConfig.timeRange = {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        };
      }

      if (journeyTypes) {
        analysisConfig.journeyTypes = Array.isArray(journeyTypes)
          ? journeyTypes
          : [journeyTypes];
      }

      if (channels) {
        analysisConfig.channels = Array.isArray(channels)
          ? channels
          : [channels];
      }

      if (includeIndonesianContext !== undefined) {
        analysisConfig.includeIndonesianContext = includeIndonesianContext;
      }

      if (minPathFrequency !== undefined) {
        analysisConfig.minPathFrequency = minPathFrequency;
      }

      const pathAnalyses =
        await this.customerJourneyTrackingService.analyzeJourneyPaths(
          tenantId,
          analysisConfig,
        );

      return {
        success: true,
        data: pathAnalyses,
        message: 'Journey path analysis completed successfully',
        meta: {
          totalPaths: pathAnalyses.pathAnalysis?.length || 0,
          analysisConfig,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze journey paths: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Analyze touchpoint effectiveness
   */
  @Get('analytics/touchpoint-effectiveness')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Analyze touchpoint effectiveness',
    description:
      'Comprehensive analysis of touchpoint effectiveness with Indonesian market insights',
  })
  @ApiQuery({
    name: 'startDate',
    type: 'string',
    required: false,
    description: 'Analysis start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    type: 'string',
    required: false,
    description: 'Analysis end date (ISO string)',
  })
  @ApiQuery({
    name: 'touchpointTypes',
    type: 'string',
    isArray: true,
    required: false,
    description: 'Touchpoint types to analyze',
  })
  @ApiQuery({
    name: 'channels',
    type: 'string',
    isArray: true,
    required: false,
    description: 'Channels to analyze',
  })
  @ApiQuery({
    name: 'includeIndonesianMetrics',
    type: 'boolean',
    required: false,
    description: 'Include Indonesian-specific metrics',
  })
  @ApiQuery({
    name: 'minSampleSize',
    type: 'number',
    required: false,
    description: 'Minimum sample size threshold',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Touchpoint effectiveness analysis completed successfully',
  })
  async analyzeTouchpointEffectiveness(
    @GetTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('touchpointTypes') touchpointTypes?: TouchpointType[],
    @Query('channels') channels?: CustomerJourneyChannel[],
    @Query('includeIndonesianMetrics') includeIndonesianMetrics?: boolean,
    @Query('minSampleSize') minSampleSize?: number,
  ) {
    try {
      const analysisConfig: any = {};

      if (startDate && endDate) {
        analysisConfig.timeRange = {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        };
      }

      if (touchpointTypes) {
        analysisConfig.touchpointTypes = Array.isArray(touchpointTypes)
          ? touchpointTypes
          : [touchpointTypes];
      }

      if (channels) {
        analysisConfig.channels = Array.isArray(channels)
          ? channels
          : [channels];
      }

      if (includeIndonesianMetrics !== undefined) {
        analysisConfig.includeIndonesianMetrics = includeIndonesianMetrics;
      }

      if (minSampleSize !== undefined) {
        analysisConfig.minSampleSize = minSampleSize;
      }

      const effectivenessAnalyses =
        await this.customerJourneyTrackingService.analyzeTouchpointEffectiveness(
          tenantId,
          analysisConfig,
        );

      return {
        success: true,
        data: effectivenessAnalyses,
        message: 'Touchpoint effectiveness analysis completed successfully',
        meta: {
          totalGroups: effectivenessAnalyses.channelEffectiveness?.length || 0,
          analysisConfig,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze touchpoint effectiveness: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Optimize customer journey
   */
  @Post('journeys/:journeyId/optimize')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Optimize customer journey',
    description:
      'Automated journey optimization with Indonesian business intelligence recommendations',
  })
  @ApiParam({ name: 'journeyId', description: 'Customer journey ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Journey optimization completed successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Journey not found',
  })
  async optimizeCustomerJourney(
    @GetTenant() tenantId: string,
    @Param('journeyId') journeyId: string,
    @Body()
    optimizationGoals: {
      improveSatisfaction?: boolean;
      reduceEffort?: boolean;
      increaseConversion?: boolean;
      enhanceIndonesianContext?: boolean;
      optimizeForMobile?: boolean;
    } = {},
  ) {
    try {
      const optimizationResult =
        await this.customerJourneyTrackingService.optimizeCustomerJourney(
          tenantId,
          journeyId,
          optimizationGoals,
        );

      return {
        success: true,
        data: optimizationResult,
        message: 'Journey optimization completed successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to optimize journey: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  // =============================================
  // ULTRATHINK: JOURNEY MANAGEMENT ENDPOINTS
  // =============================================

  /**
   * Get customer journeys
   */
  @Get('customers/:customerId/journeys')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get customer journeys',
    description:
      'Retrieves all journeys for a specific customer with analytics',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiQuery({
    name: 'status',
    enum: CustomerJourneyStatus,
    required: false,
    description: 'Filter by journey status',
  })
  @ApiQuery({
    name: 'journeyType',
    enum: CustomerJourneyType,
    required: false,
    description: 'Filter by journey type',
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'Limit number of results',
  })
  @ApiQuery({
    name: 'offset',
    type: 'number',
    required: false,
    description: 'Offset for pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer journeys retrieved successfully',
  })
  async getCustomerJourneys(
    @GetTenant() tenantId: string,
    @Param('customerId') customerId: string,
    @Query('status') status?: CustomerJourneyStatus,
    @Query('journeyType') journeyType?: CustomerJourneyType,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const result =
        await this.customerJourneyTrackingService.getCustomerJourneys(
          tenantId,
          customerId,
          { status, journeyType, limit, offset },
        );

      return {
        success: true,
        data: result.journeys,
        message: 'Customer journeys retrieved successfully',
        meta: {
          total: result.total,
          limit,
          offset,
          filters: { status, journeyType },
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get customer journeys: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get journey touchpoints
   */
  @Get('journeys/:journeyId/touchpoints')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get journey touchpoints',
    description:
      'Retrieves all touchpoints for a specific journey with analytics',
  })
  @ApiParam({ name: 'journeyId', description: 'Journey ID' })
  @ApiQuery({
    name: 'touchpointType',
    enum: TouchpointType,
    required: false,
    description: 'Filter by touchpoint type',
  })
  @ApiQuery({
    name: 'status',
    enum: TouchpointStatus,
    required: false,
    description: 'Filter by touchpoint status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Journey touchpoints retrieved successfully',
  })
  async getJourneyTouchpoints(
    @GetTenant() tenantId: string,
    @Param('journeyId') journeyId: string,
    @Query('touchpointType') touchpointType?: TouchpointType,
    @Query('status') status?: TouchpointStatus,
  ) {
    try {
      const touchpoints =
        await this.customerJourneyTrackingService.getJourneyTouchpoints(
          tenantId,
          journeyId,
          { touchpointType, status },
        );

      return {
        success: true,
        data: touchpoints,
        message: 'Journey touchpoints retrieved successfully',
        meta: {
          journeyId,
          total: touchpoints.length,
          filters: { touchpointType, status },
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get journey touchpoints: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get touchpoint interactions
   */
  @Get('touchpoints/:touchpointId/interactions')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get touchpoint interactions',
    description:
      'Retrieves all interactions for a specific touchpoint with quality metrics',
  })
  @ApiParam({ name: 'touchpointId', description: 'Touchpoint ID' })
  @ApiQuery({
    name: 'interactionType',
    enum: InteractionType,
    required: false,
    description: 'Filter by interaction type',
  })
  @ApiQuery({
    name: 'status',
    enum: InteractionStatus,
    required: false,
    description: 'Filter by interaction status',
  })
  @ApiQuery({
    name: 'sentiment',
    enum: InteractionSentiment,
    required: false,
    description: 'Filter by sentiment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Touchpoint interactions retrieved successfully',
  })
  async getTouchpointInteractions(
    @GetTenant() tenantId: string,
    @Param('touchpointId') touchpointId: string,
    @Query('interactionType') interactionType?: InteractionType,
    @Query('status') status?: InteractionStatus,
    @Query('sentiment') sentiment?: InteractionSentiment,
  ) {
    try {
      const interactions =
        await this.customerJourneyTrackingService.getTouchpointInteractions(
          tenantId,
          touchpointId,
          { interactionType, status, sentiment },
        );

      return {
        success: true,
        data: interactions,
        message: 'Touchpoint interactions retrieved successfully',
        meta: {
          touchpointId,
          total: interactions.length,
          filters: { interactionType, status, sentiment },
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get touchpoint interactions: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  // =============================================
  // ULTRATHINK: REAL-TIME ANALYTICS ENDPOINTS
  // =============================================

  /**
   * Get real-time journey analytics dashboard
   */
  @Get('analytics/dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get real-time analytics dashboard',
    description: 'Real-time dashboard data with Indonesian business insights',
  })
  @ApiQuery({
    name: 'timeRange',
    enum: ['hour', 'day', 'week', 'month'],
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard data retrieved successfully',
  })
  async getAnalyticsDashboard(
    @GetTenant() tenantId: string,
    @Query('timeRange') timeRange: 'hour' | 'day' | 'week' | 'month' = 'day',
  ) {
    try {
      const dashboardData =
        await this.customerJourneyTrackingService.getAnalyticsDashboard(
          tenantId,
          timeRange,
        );

      return {
        success: true,
        data: dashboardData,
        message: 'Dashboard data retrieved successfully',
        meta: {
          timeRange,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get analytics dashboard: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get Indonesian market insights summary
   */
  @Get('analytics/indonesian-insights')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get Indonesian market insights',
    description:
      'Comprehensive Indonesian market insights and cultural analysis',
  })
  @ApiQuery({
    name: 'region',
    type: 'string',
    required: false,
    description: 'Specific region to analyze',
  })
  @ApiQuery({
    name: 'startDate',
    type: 'string',
    required: false,
    description: 'Analysis start date',
  })
  @ApiQuery({
    name: 'endDate',
    type: 'string',
    required: false,
    description: 'Analysis end date',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Indonesian insights retrieved successfully',
  })
  async getIndonesianMarketInsights(
    @GetTenant() tenantId: string,
    @Query('region') region?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const insights =
        await this.customerJourneyTrackingService.getIndonesianMarketInsights(
          tenantId,
          { region, startDate, endDate },
        );

      return {
        success: true,
        data: insights,
        message: 'Indonesian market insights retrieved successfully',
        meta: {
          region,
          timeRange: { startDate, endDate },
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get Indonesian insights: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }
}
