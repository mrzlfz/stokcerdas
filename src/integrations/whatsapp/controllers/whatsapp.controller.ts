import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
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
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { TenantGuard } from '../../../auth/guards/tenant.guard';
import { UserRole } from '../../../users/entities/user.entity';

import {
  WhatsAppAuthService,
  WhatsAppAuthConfig,
} from '../services/whatsapp-auth.service';
import {
  WhatsAppMessageService,
  WhatsAppTextMessage,
  WhatsAppTemplateMessage,
  WhatsAppInteractiveMessage,
  WhatsAppMediaMessage,
  WhatsAppLocationMessage,
  WhatsAppContactMessage,
  BulkMessageRequest,
} from '../services/whatsapp-message.service';
import {
  WhatsAppTemplateService,
  CreateTemplateRequest,
} from '../services/whatsapp-template.service';

// DTOs for API validation
export class WhatsAppAuthConfigDto {
  appId: string;
  appSecret: string;
  accessToken: string;
  businessAccountId: string;
  phoneNumberId: string;
  verifyToken: string;
  webhookUrl?: string;
  sandbox?: boolean;
  version?: string;
}

export class WhatsAppTextMessageDto {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export class WhatsAppTemplateMessageDto {
  to: string;
  templateName: string;
  languageCode: string;
  components?: any[];
}

export class WhatsAppInteractiveMessageDto {
  to: string;
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    text?: string;
    image?: { id?: string; link?: string };
    video?: { id?: string; link?: string };
    document?: { id?: string; link?: string; filename?: string };
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: any;
}

export class WhatsAppMediaMessageDto {
  to: string;
  type: 'image' | 'audio' | 'video' | 'document' | 'sticker';
  media: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
}

export class WhatsAppLocationMessageDto {
  to: string;
  longitude: number;
  latitude: number;
  name?: string;
  address?: string;
}

export class WhatsAppContactMessageDto {
  to: string;
  contacts: any[];
}

export class BulkMessageRequestDto {
  recipients: string[];
  message:
    | WhatsAppTextMessageDto
    | WhatsAppTemplateMessageDto
    | WhatsAppInteractiveMessageDto;
  sendDelay?: number;
}

export class CreateTemplateRequestDto {
  name: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  language: string;
  components: any[];
}

export class TemplateFiltersDto {
  status?: string;
  category?: string;
  language?: string;
  name?: string;
}

@ApiTags('WhatsApp Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('integrations/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly authService: WhatsAppAuthService,
    private readonly messageService: WhatsAppMessageService,
    private readonly templateService: WhatsAppTemplateService,
  ) {}

  // Authentication endpoints

  @Post('auth/setup/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Setup WhatsApp Business API credentials' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'WhatsApp credentials configured successfully',
  })
  async setupCredentials(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() config: WhatsAppAuthConfigDto,
  ) {
    try {
      const result = await this.authService.storeCredentials(
        user.tenantId,
        channelId,
        config,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to setup WhatsApp credentials: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('auth/status/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get WhatsApp authentication status' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 200,
    description: 'Authentication status retrieved successfully',
  })
  async getAuthStatus(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      const result = await this.authService.getChannelStatus(
        user.tenantId,
        channelId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get auth status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('auth/test/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Test WhatsApp authentication' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Authentication tested successfully',
  })
  async testAuthentication(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      const result = await this.authService.testAuthentication(
        user.tenantId,
        channelId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Authentication test failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('auth/revoke/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Revoke WhatsApp authentication' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 200,
    description: 'Authentication revoked successfully',
  })
  async revokeAuthentication(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      const result = await this.authService.revokeAuthentication(
        user.tenantId,
        channelId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to revoke authentication: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('auth/webhook/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update webhook URL and verify token' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        webhookUrl: { type: 'string' },
        verifyToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook configuration updated successfully',
  })
  async updateWebhook(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() body: { webhookUrl: string; verifyToken: string },
  ) {
    try {
      const result = await this.authService.updateWebhookUrl(
        user.tenantId,
        channelId,
        body.webhookUrl,
        body.verifyToken,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update webhook: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Message endpoints

  @Post('messages/text/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Send text message' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Text message sent successfully' })
  async sendTextMessage(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() messageData: WhatsAppTextMessageDto,
  ) {
    try {
      const result = await this.messageService.sendTextMessage(
        user.tenantId,
        channelId,
        messageData,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send text message: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('messages/template/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Send template message' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Template message sent successfully',
  })
  async sendTemplateMessage(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() messageData: WhatsAppTemplateMessageDto,
  ) {
    try {
      const result = await this.messageService.sendTemplateMessage(
        user.tenantId,
        channelId,
        messageData,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send template message: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('messages/interactive/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Send interactive message (buttons, lists, etc.)' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Interactive message sent successfully',
  })
  async sendInteractiveMessage(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() messageData: WhatsAppInteractiveMessageDto,
  ) {
    try {
      const result = await this.messageService.sendInteractiveMessage(
        user.tenantId,
        channelId,
        messageData,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send interactive message: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('messages/media/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Send media message (image, video, document, etc.)',
  })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Media message sent successfully' })
  async sendMediaMessage(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() messageData: WhatsAppMediaMessageDto,
  ) {
    try {
      const result = await this.messageService.sendMediaMessage(
        user.tenantId,
        channelId,
        messageData,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send media message: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('messages/location/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Send location message' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Location message sent successfully',
  })
  async sendLocationMessage(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() messageData: WhatsAppLocationMessageDto,
  ) {
    try {
      const result = await this.messageService.sendLocationMessage(
        user.tenantId,
        channelId,
        messageData,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send location message: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('messages/contact/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Send contact message' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Contact message sent successfully',
  })
  async sendContactMessage(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() messageData: WhatsAppContactMessageDto,
  ) {
    try {
      const result = await this.messageService.sendContactMessage(
        user.tenantId,
        channelId,
        messageData,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send contact message: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('messages/bulk/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Send bulk messages to multiple recipients' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Bulk messages sent successfully' })
  async sendBulkMessages(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() bulkRequest: BulkMessageRequestDto,
  ) {
    try {
      const result = await this.messageService.sendBulkMessages(
        user.tenantId,
        channelId,
        bulkRequest,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send bulk messages: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('messages/mark-read/:channelId/:messageId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Mark message as read' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({
    status: 201,
    description: 'Message marked as read successfully',
  })
  async markMessageAsRead(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
  ) {
    try {
      const result = await this.messageService.markMessageAsRead(
        user.tenantId,
        channelId,
        messageId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to mark message as read: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Template endpoints

  @Get('templates/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get message templates' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Filter by language',
  })
  @ApiQuery({ name: 'name', required: false, description: 'Filter by name' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getTemplates(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Query() filters: TemplateFiltersDto,
  ) {
    try {
      const result = await this.templateService.getTemplates(
        user.tenantId,
        channelId,
        filters,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get templates: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('templates/:channelId/:templateId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get specific template by ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  async getTemplate(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('templateId') templateId: string,
  ) {
    try {
      const result = await this.templateService.getTemplate(
        user.tenantId,
        channelId,
        templateId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get template: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('templates/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create new message template' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() templateRequest: CreateTemplateRequestDto,
  ) {
    try {
      const result = await this.templateService.createTemplate(
        user.tenantId,
        channelId,
        templateRequest,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create template: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('templates/:channelId/:templateId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete message template' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiQuery({ name: 'name', description: 'Template name' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deleteTemplate(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('templateId') templateId: string,
    @Query('name') templateName: string,
  ) {
    try {
      const result = await this.templateService.deleteTemplate(
        user.tenantId,
        channelId,
        templateId,
        templateName,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete template: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('templates/library/list')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get template library with pre-defined templates' })
  @ApiResponse({
    status: 200,
    description: 'Template library retrieved successfully',
  })
  async getTemplateLibrary() {
    try {
      const library = this.templateService.getTemplateLibrary();

      return {
        success: true,
        data: library,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get template library: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('templates/library/:channelId/:templateType')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create template from library' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'templateType', description: 'Template type from library' })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Language code (default: id)',
  })
  @ApiResponse({
    status: 201,
    description: 'Template created from library successfully',
  })
  async createTemplateFromLibrary(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('templateType') templateType: string,
    @Query('language') language: string = 'id',
  ) {
    try {
      const result = await this.templateService.createTemplateFromLibrary(
        user.tenantId,
        channelId,
        templateType as any,
        language,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create template from library: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('templates/stats/:channelId/:templateName')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get template usage statistics' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'templateName', description: 'Template name' })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO string)' })
  @ApiResponse({
    status: 200,
    description: 'Template statistics retrieved successfully',
  })
  async getTemplateStats(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('templateName') templateName: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      const result = await this.templateService.getTemplateUsageStats(
        user.tenantId,
        channelId,
        templateName,
        new Date(startDate),
        new Date(endDate),
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get template stats: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
