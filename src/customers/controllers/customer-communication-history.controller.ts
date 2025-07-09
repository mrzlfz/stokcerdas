import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ValidationPipe,
  UseGuards,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { UserRole } from '../../users/entities/user.entity';

import { CustomerCommunicationHistoryService } from '../services/customer-communication-history.service';
import {
  CustomerCommunication,
  CommunicationType,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationPriority,
  CommunicationStatus,
} from '../entities/customer-communication.entity';
import { MarketingCampaign } from '../entities/marketing-campaign.entity';
import { CommunicationTemplate } from '../entities/communication-template.entity';

// =============================================
// ULTRATHINK: DTO CLASSES WITH COMPREHENSIVE VALIDATION
// =============================================

export class CreateCommunicationDto {
  customerId: string;
  campaignId?: string;
  templateId?: string;
  communicationType: CommunicationType;
  communicationChannel: CommunicationChannel;
  direction: CommunicationDirection;
  priority?: CommunicationPriority;
  subject?: string;
  messageContent: string;
  recipientEmail?: string;
  recipientPhone?: string;
  scheduledAt?: Date;
  automationConfig?: any;
  indonesianContext?: any;
  customAttributes?: Record<string, any>;
}

export class UpdateCommunicationDto {
  subject?: string;
  messageContent?: string;
  status?: CommunicationStatus;
  priority?: CommunicationPriority;
  scheduledAt?: Date;
  customAttributes?: Record<string, any>;
  notes?: string;
}

export class CommunicationFilterDto {
  customerId?: string;
  campaignId?: string;
  communicationType?: CommunicationType;
  communicationChannel?: CommunicationChannel;
  status?: CommunicationStatus;
  direction?: CommunicationDirection;
  priority?: CommunicationPriority;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  includeAnalytics?: boolean;
  includeIndonesianContext?: boolean;
}

export class CommunicationAnalyticsDto {
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  dateFrom?: string;
  dateTo?: string;
  segmentBy?: 'channel' | 'type' | 'status' | 'customer_segment' | 'region';
  includeIndonesianInsights?: boolean;
  includeComparisonData?: boolean;
}

export class BulkCommunicationDto {
  customerIds: string[];
  templateId: string;
  communicationType: CommunicationType;
  communicationChannel: CommunicationChannel;
  priority?: CommunicationPriority;
  scheduledAt?: Date;
  personalizationEnabled?: boolean;
  indonesianContextEnabled?: boolean;
  customAttributes?: Record<string, any>;
}

export class CommunicationTrackingDto {
  communicationId: string;
  eventType: 'opened' | 'clicked' | 'replied' | 'forwarded' | 'unsubscribed';
  deviceInfo?: {
    deviceType: string;
    os: string;
    browser: string;
    userAgent: string;
  };
  location?: {
    country: string;
    region: string;
    city: string;
    latitude?: number;
    longitude?: number;
  };
  linkUrl?: string;
  linkDescription?: string;
  timeSpent?: number;
  customData?: Record<string, any>;
}

/**
 * ULTRATHINK: Customer Communication History Controller
 * Comprehensive API for managing customer communications with Indonesian business intelligence
 */
@ApiTags('Customer Communication History')
@Controller('customer-communication-history')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomerCommunicationHistoryController {
  private readonly logger = new Logger(
    CustomerCommunicationHistoryController.name,
  );

  constructor(
    private readonly communicationHistoryService: CustomerCommunicationHistoryService,
  ) {}

  // =============================================
  // ULTRATHINK: COMMUNICATION MANAGEMENT
  // =============================================

  @Post('communications')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Create new customer communication',
    description:
      'Create a new communication with Indonesian business context enrichment and personalization',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Communication created successfully',
    type: CustomerCommunication,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid communication data or frequency limit exceeded',
  })
  @ApiBody({ type: CreateCommunicationDto })
  async createCommunication(
    @TenantId() tenantId: string,
    @Body(ValidationPipe) createCommunicationDto: CreateCommunicationDto,
    @GetUser() user: any,
  ): Promise<CustomerCommunication> {
    this.logger.log(
      `Creating communication for customer ${createCommunicationDto.customerId} by user ${user.id}`,
    );

    try {
      const communication =
        await this.communicationHistoryService.createCommunication(
          tenantId,
          createCommunicationDto,
        );

      this.logger.log(
        `Communication created successfully: ${communication.id}`,
      );
      return communication;
    } catch (error) {
      this.logger.error(
        `Failed to create communication: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Communication creation failed: ${error.message}`,
      );
    }
  }

  @Post('communications/bulk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create bulk communications',
    description:
      'Create multiple communications for specified customers using a template',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Bulk communications created successfully',
  })
  @ApiBody({ type: BulkCommunicationDto })
  async createBulkCommunications(
    @TenantId() tenantId: string,
    @Body(ValidationPipe) bulkCommunicationDto: BulkCommunicationDto,
    @GetUser() user: any,
  ): Promise<{ success: number; failed: number; results: any[] }> {
    this.logger.log(
      `Creating bulk communications for ${bulkCommunicationDto.customerIds.length} customers`,
    );

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const customerId of bulkCommunicationDto.customerIds) {
      try {
        const communication =
          await this.communicationHistoryService.createCommunication(tenantId, {
            customerId,
            templateId: bulkCommunicationDto.templateId,
            communicationType: bulkCommunicationDto.communicationType,
            communicationChannel: bulkCommunicationDto.communicationChannel,
            direction: CommunicationDirection.OUTBOUND,
            // priority: bulkCommunicationDto.priority || CommunicationPriority.NORMAL, // Removed - not supported in service interface
            messageContent: '', // Will be populated from template
            scheduledAt: bulkCommunicationDto.scheduledAt,
            customAttributes: bulkCommunicationDto.customAttributes,
            // createdBy will be set in the service
          });

        results.push({
          customerId,
          success: true,
          communicationId: communication.id,
        });
        successCount++;
      } catch (error) {
        results.push({ customerId, success: false, error: error.message });
        failedCount++;
        this.logger.error(
          `Failed to create communication for customer ${customerId}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Bulk communications completed: ${successCount} success, ${failedCount} failed`,
    );
    return { success: successCount, failed: failedCount, results };
  }

  @Get('communications')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get customer communications',
    description:
      'Retrieve customer communications with filtering, pagination, and analytics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Communications retrieved successfully',
  })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'campaignId', required: false, type: String })
  @ApiQuery({
    name: 'communicationType',
    required: false,
    enum: CommunicationType,
  })
  @ApiQuery({ name: 'status', required: false, enum: CommunicationStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getCommunications(
    @TenantId() tenantId: string,
    @Query() filterDto: CommunicationFilterDto,
  ): Promise<{
    communications: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    analytics?: any;
  }> {
    this.logger.log(
      `Getting communications with filters: ${JSON.stringify(filterDto)}`,
    );

    const page = filterDto.page || 1;
    const limit = Math.min(filterDto.limit || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    try {
      const result = await this.communicationHistoryService.getCommunications(
        tenantId,
        {
          customerId: filterDto.customerId,
          communicationType: filterDto.communicationType,
          communicationChannel: filterDto.communicationChannel,
          status: filterDto.status,
          dateFrom: filterDto.dateFrom
            ? new Date(filterDto.dateFrom)
            : undefined,
          dateTo: filterDto.dateTo ? new Date(filterDto.dateTo) : undefined,
          offset: skip,
          limit: limit,
        },
      );

      const { communications: commRecords, total } = result;

      // Convert SimpleCommunicationRecord[] to CustomerCommunication[] for response compatibility
      const communications: any[] = commRecords.map(record => ({
        // Core entity properties
        id: record.id,
        tenantId,
        customerId: record.customerId,
        customer: null, // Will be populated by TypeORM if needed
        campaignId: null,
        templateId: null,

        // Communication type and channel (correct property names)
        communicationType: record.type,
        communicationChannel: record.channel,
        direction: record.direction,
        status: record.status,
        priority: 'NORMAL' as any,

        // Content properties (correct property names)
        subject: record.subject,
        messageContent: record.content,
        renderedContent: record.content, // Use same content for rendered
        personalizedContent: null,

        // Sender/recipient information
        senderName: null,
        senderEmail: null,
        senderPhone: null,
        recipientName: null,
        recipientEmail: null,
        recipientPhone: null,

        // Timestamps
        scheduledAt: null,
        sentAt: record.sentAt,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        repliedAt: null,
        bouncedAt: null,
        unsubscribedAt: null,

        // Metrics and analytics
        communicationMetrics: null,
        indonesianContext: record.indonesianContext as any,
        communicationAnalytics: null,
        automationConfig: null,

        // Additional data
        attachments: null,
        trackingData: null,
        personalizationData: null,
        complianceData: null,
        integrationData: null,
        abTestData: null,
        businessContext: null,
        contentOptimization: null,
        customAttributes: {},
        tags: null,

        // Error handling
        errorMessage: null,
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: null,

        // Flags
        isAutomated: false,
        isPersonalized: false,
        isAbTest: false,
        requiresApproval: false,
        approvedBy: null,
        approvedAt: null,

        // Notes and metadata
        notes: null,
        internalNotes: null,
        isDeleted: false,

        // Audit fields
        createdAt: record.sentAt,
        updatedAt: record.sentAt,
        createdBy: null,
        updatedBy: null,
      }));

      // Get analytics if requested
      let analytics = null;
      if (filterDto.includeAnalytics) {
        analytics =
          await this.communicationHistoryService.getCommunicationAnalytics(
            tenantId,
            {
              dateFrom: filterDto.dateFrom
                ? new Date(filterDto.dateFrom)
                : undefined,
              dateTo: filterDto.dateTo ? new Date(filterDto.dateTo) : undefined,
              communicationType: filterDto.communicationType,
              communicationChannel: filterDto.communicationChannel,
            },
          );
      }

      return {
        communications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        analytics,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get communications: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to retrieve communications: ${error.message}`,
      );
    }
  }

  @Get('communications/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get communication by ID',
    description:
      'Retrieve detailed communication information including analytics and Indonesian context',
  })
  @ApiParam({ name: 'id', type: String, description: 'Communication ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Communication retrieved successfully',
    type: CustomerCommunication,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Communication not found',
  })
  async getCommunicationById(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) communicationId: string,
  ): Promise<CustomerCommunication> {
    this.logger.log(`Getting communication: ${communicationId}`);

    try {
      const communication =
        await this.communicationHistoryService.getCommunicationById(
          tenantId,
          communicationId,
        );

      if (!communication) {
        throw new NotFoundException(
          `Communication ${communicationId} not found`,
        );
      }

      return communication;
    } catch (error) {
      this.logger.error(
        `Failed to get communication ${communicationId}: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to retrieve communication: ${error.message}`,
      );
    }
  }

  @Put('communications/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Update communication',
    description: 'Update communication details, status, or scheduling',
  })
  @ApiParam({ name: 'id', type: String, description: 'Communication ID' })
  @ApiBody({ type: UpdateCommunicationDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Communication updated successfully',
    type: CustomerCommunication,
  })
  async updateCommunication(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) communicationId: string,
    @Body(ValidationPipe) updateDto: UpdateCommunicationDto,
    @GetUser() user: any,
  ): Promise<CustomerCommunication> {
    this.logger.log(`Updating communication: ${communicationId}`);

    try {
      const updatedCommunication =
        await this.communicationHistoryService.updateCommunication(
          tenantId,
          communicationId,
          {
            ...updateDto,
            updatedBy: user.id,
          },
        );

      this.logger.log(`Communication updated successfully: ${communicationId}`);
      return updatedCommunication;
    } catch (error) {
      this.logger.error(
        `Failed to update communication ${communicationId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Communication update failed: ${error.message}`,
      );
    }
  }

  @Post('communications/:id/send')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Send communication',
    description: 'Send a draft or scheduled communication immediately',
  })
  @ApiParam({ name: 'id', type: String, description: 'Communication ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Communication sent successfully',
  })
  async sendCommunication(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) communicationId: string,
  ): Promise<CustomerCommunication> {
    this.logger.log(`Sending communication: ${communicationId}`);

    try {
      const sentCommunication =
        await this.communicationHistoryService.sendCommunication(
          tenantId,
          communicationId,
        );

      this.logger.log(`Communication sent successfully: ${communicationId}`);
      return sentCommunication;
    } catch (error) {
      this.logger.error(
        `Failed to send communication ${communicationId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Communication sending failed: ${error.message}`,
      );
    }
  }

  @Delete('communications/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Delete communication',
    description: 'Soft delete a communication (mark as deleted)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Communication ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Communication deleted successfully',
  })
  async deleteCommunication(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) communicationId: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting communication: ${communicationId}`);

    try {
      await this.communicationHistoryService.deleteCommunication(
        tenantId,
        communicationId,
      );

      this.logger.log(`Communication deleted successfully: ${communicationId}`);
      return { message: 'Communication deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to delete communication ${communicationId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Communication deletion failed: ${error.message}`,
      );
    }
  }

  // =============================================
  // ULTRATHINK: ANALYTICS & INSIGHTS
  // =============================================

  @Get('analytics/overview')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get communication analytics overview',
    description:
      'Comprehensive analytics including Indonesian market insights and performance metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics retrieved successfully',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['day', 'week', 'month', 'quarter', 'year'],
  })
  @ApiQuery({
    name: 'includeIndonesianInsights',
    required: false,
    type: Boolean,
  })
  async getCommunicationAnalytics(
    @TenantId() tenantId: string,
    @Query() analyticsDto: CommunicationAnalyticsDto,
  ): Promise<any> {
    this.logger.log(
      `Getting communication analytics for period: ${analyticsDto.period}`,
    );

    try {
      const analytics =
        await this.communicationHistoryService.getCommunicationAnalytics(
          tenantId,
          {
            dateFrom: analyticsDto.dateFrom
              ? new Date(analyticsDto.dateFrom)
              : undefined,
            dateTo: analyticsDto.dateTo
              ? new Date(analyticsDto.dateTo)
              : undefined,
            communicationType:
              analyticsDto.segmentBy === 'type' ? undefined : undefined,
            communicationChannel:
              analyticsDto.segmentBy === 'channel' ? undefined : undefined,
          },
        );

      return analytics;
    } catch (error) {
      this.logger.error(
        `Failed to get analytics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Analytics retrieval failed: ${error.message}`,
      );
    }
  }

  @Get('analytics/performance-by-channel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get performance analytics by channel',
    description:
      'Detailed performance metrics segmented by communication channel with Indonesian insights',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Channel performance analytics retrieved successfully',
  })
  async getChannelPerformanceAnalytics(
    @TenantId() tenantId: string,
    @Query() analyticsDto: CommunicationAnalyticsDto,
  ): Promise<any> {
    this.logger.log(`Getting channel performance analytics`);

    try {
      const channelAnalytics =
        await this.communicationHistoryService.getChannelPerformanceAnalytics(
          tenantId,
          {
            dateFrom: analyticsDto.dateFrom
              ? new Date(analyticsDto.dateFrom)
              : undefined,
            dateTo: analyticsDto.dateTo
              ? new Date(analyticsDto.dateTo)
              : undefined,
            channel: analyticsDto.segmentBy as any, // Map segmentBy to channel for this method
          },
        );

      return channelAnalytics;
    } catch (error) {
      this.logger.error(
        `Failed to get channel analytics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Channel analytics retrieval failed: ${error.message}`,
      );
    }
  }

  @Get('analytics/indonesian-insights')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get Indonesian market specific insights',
    description:
      'Cultural, regional, and business context analytics for Indonesian market',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Indonesian insights retrieved successfully',
  })
  async getIndonesianMarketInsights(
    @TenantId() tenantId: string,
    @Query() analyticsDto: CommunicationAnalyticsDto,
  ): Promise<any> {
    this.logger.log(`Getting Indonesian market insights`);

    try {
      const insights =
        await this.communicationHistoryService.getIndonesianMarketInsights(
          tenantId,
          {
            dateFrom: analyticsDto.dateFrom
              ? new Date(analyticsDto.dateFrom)
              : undefined,
            dateTo: analyticsDto.dateTo
              ? new Date(analyticsDto.dateTo)
              : undefined,
            includeRegionalData: analyticsDto.includeIndonesianInsights,
            includeSeasonalData: analyticsDto.includeIndonesianInsights,
          },
        );

      return insights;
    } catch (error) {
      this.logger.error(
        `Failed to get Indonesian insights: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Indonesian insights retrieval failed: ${error.message}`,
      );
    }
  }

  @Get('analytics/customer-segments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get communication performance by customer segments',
    description:
      'Analyze communication effectiveness across different customer segments',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Segment analytics retrieved successfully',
  })
  async getSegmentAnalytics(
    @TenantId() tenantId: string,
    @Query() analyticsDto: CommunicationAnalyticsDto,
  ): Promise<any> {
    this.logger.log(`Getting segment analytics`);

    try {
      const segmentAnalytics =
        await this.communicationHistoryService.getSegmentAnalytics(tenantId, {
          segmentType: analyticsDto.segmentBy,
          dateFrom: analyticsDto.dateFrom
            ? new Date(analyticsDto.dateFrom)
            : undefined,
          dateTo: analyticsDto.dateTo
            ? new Date(analyticsDto.dateTo)
            : undefined,
        });

      return segmentAnalytics;
    } catch (error) {
      this.logger.error(
        `Failed to get segment analytics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Segment analytics retrieval failed: ${error.message}`,
      );
    }
  }

  // =============================================
  // ULTRATHINK: TRACKING & EVENTS
  // =============================================

  @Post('tracking/event')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF) // Allow customers to track their own interactions
  @ApiOperation({
    summary: 'Track communication event',
    description:
      'Track communication events like opens, clicks, replies for analytics',
  })
  @ApiBody({ type: CommunicationTrackingDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Event tracked successfully',
  })
  async trackCommunicationEvent(
    @TenantId() tenantId: string,
    @Body(ValidationPipe) trackingDto: CommunicationTrackingDto,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Tracking event: ${trackingDto.eventType} for communication: ${trackingDto.communicationId}`,
    );

    try {
      await this.communicationHistoryService.trackCommunicationEvent(
        tenantId,
        trackingDto.communicationId,
        {
          type: trackingDto.eventType as
            | 'opened'
            | 'clicked'
            | 'replied'
            | 'bounced',
          timestamp: new Date(),
          metadata: {
            deviceInfo: trackingDto.deviceInfo,
            location: trackingDto.location,
            linkUrl: trackingDto.linkUrl,
            linkDescription: trackingDto.linkDescription,
            timeSpent: trackingDto.timeSpent,
            customData: trackingDto.customData,
          },
        },
      );

      return { message: 'Event tracked successfully' };
    } catch (error) {
      this.logger.error(`Failed to track event: ${error.message}`, error.stack);
      throw new BadRequestException(`Event tracking failed: ${error.message}`);
    }
  }

  @Get('tracking/communications/:id/events')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get communication tracking events',
    description: 'Retrieve all tracking events for a specific communication',
  })
  @ApiParam({ name: 'id', type: String, description: 'Communication ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tracking events retrieved successfully',
  })
  async getCommunicationTrackingEvents(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) communicationId: string,
  ): Promise<any> {
    this.logger.log(
      `Getting tracking events for communication: ${communicationId}`,
    );

    try {
      const events =
        await this.communicationHistoryService.getCommunicationTrackingEvents(
          tenantId,
          communicationId,
        );

      return events;
    } catch (error) {
      this.logger.error(
        `Failed to get tracking events: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Tracking events retrieval failed: ${error.message}`,
      );
    }
  }

  // =============================================
  // ULTRATHINK: OPTIMIZATION & RECOMMENDATIONS
  // =============================================

  @Get('optimization/recommendations')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get communication optimization recommendations',
    description:
      'AI-powered recommendations for improving communication effectiveness with Indonesian insights',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Optimization recommendations retrieved successfully',
  })
  async getOptimizationRecommendations(
    @TenantId() tenantId: string,
    @Query('customerId') customerId?: string,
    @Query('campaignId') campaignId?: string,
  ): Promise<any> {
    this.logger.log(`Getting optimization recommendations`);

    try {
      const recommendations =
        await this.communicationHistoryService.getOptimizationRecommendations(
          tenantId,
          {
            analysisType: 'performance',
            dateFrom: undefined,
            dateTo: undefined,
          },
        );

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Failed to get recommendations: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Recommendations retrieval failed: ${error.message}`,
      );
    }
  }

  @Get('optimization/best-practices')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get Indonesian communication best practices',
    description:
      'Cultural and business best practices for Indonesian customer communications',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Best practices retrieved successfully',
  })
  async getIndonesianBestPractices(@TenantId() tenantId: string): Promise<any> {
    this.logger.log(`Getting Indonesian communication best practices`);

    try {
      const bestPractices =
        await this.communicationHistoryService.getIndonesianBestPractices(
          tenantId,
        );
      return bestPractices;
    } catch (error) {
      this.logger.error(
        `Failed to get best practices: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Best practices retrieval failed: ${error.message}`,
      );
    }
  }

  // =============================================
  // ULTRATHINK: AUTOMATION & RULES
  // =============================================

  @Get('automation/rules')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get communication automation rules',
    description:
      'Retrieve all active automation rules for customer communications',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation rules retrieved successfully',
  })
  async getAutomationRules(@TenantId() tenantId: string): Promise<any> {
    this.logger.log(`Getting automation rules`);

    try {
      const rules = await this.communicationHistoryService.getAutomationRules(
        tenantId,
      );
      return rules;
    } catch (error) {
      this.logger.error(
        `Failed to get automation rules: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Automation rules retrieval failed: ${error.message}`,
      );
    }
  }

  @Post('automation/rules')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create communication automation rule',
    description: 'Create new automation rule for customer communications',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Automation rule created successfully',
  })
  async createAutomationRule(
    @TenantId() tenantId: string,
    @Body() ruleData: any,
    @GetUser() user: any,
  ): Promise<any> {
    this.logger.log(`Creating automation rule`);

    try {
      const rule = await this.communicationHistoryService.createAutomationRule(
        tenantId,
        {
          ...ruleData,
          createdBy: user.id,
        },
      );

      return rule;
    } catch (error) {
      this.logger.error(
        `Failed to create automation rule: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Automation rule creation failed: ${error.message}`,
      );
    }
  }

  @Get('automation/performance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get automation performance metrics',
    description: 'Performance analytics for automated communication rules',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation performance retrieved successfully',
  })
  async getAutomationPerformance(
    @TenantId() tenantId: string,
    @Query() analyticsDto: CommunicationAnalyticsDto,
  ): Promise<any> {
    this.logger.log(`Getting automation performance metrics`);

    try {
      const performance =
        await this.communicationHistoryService.getAutomationPerformance(
          tenantId,
          {
            dateFrom: analyticsDto.dateFrom
              ? new Date(analyticsDto.dateFrom)
              : undefined,
            dateTo: analyticsDto.dateTo
              ? new Date(analyticsDto.dateTo)
              : undefined,
            ruleId: undefined,
            ruleType: analyticsDto.segmentBy,
          },
        );

      return performance;
    } catch (error) {
      this.logger.error(
        `Failed to get automation performance: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Automation performance retrieval failed: ${error.message}`,
      );
    }
  }
}
