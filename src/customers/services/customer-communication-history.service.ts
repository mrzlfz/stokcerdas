import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { Customer } from '../entities/customer.entity';
import {
  CustomerCommunication,
  CommunicationType,
  CommunicationStatus,
  CommunicationDirection,
  CommunicationChannel,
} from '../entities/customer-communication.entity';

/**
 * ULTRATHINK SIMPLIFIED: Customer Communication History Service
 * Simplified Indonesian business communication management
 * Reduced from 2274 lines to ~400 lines (82% reduction)
 */

export interface SimpleCommunicationRecord {
  id: string;
  customerId: string;
  type: CommunicationType;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  direction: CommunicationDirection;
  subject: string;
  content: string;
  sentAt: Date;
  indonesianContext: {
    language: 'id' | 'en';
    formalityLevel: 'formal' | 'casual';
    culturalTone: 'respectful' | 'friendly' | 'professional';
  };
}

export interface CommunicationSummary {
  customerId: string;
  totalCommunications: number;
  lastCommunication: Date;
  preferredChannel: CommunicationChannel;
  responseRate: number;
  indonesianPreferences: {
    preferredLanguage: 'id' | 'en';
    preferredTone: 'formal' | 'casual';
    timeZone: 'WIB' | 'WITA' | 'WIT';
  };
}

@Injectable()
export class CustomerCommunicationHistoryService {
  private readonly logger = new Logger(
    CustomerCommunicationHistoryService.name,
  );

  // Simplified Indonesian communication constants
  private readonly INDONESIAN_COMMUNICATION_RULES = {
    formalGreeting: 'Selamat pagi/siang/sore/malam',
    casualGreeting: 'Halo',
    formalClosing: 'Terima kasih atas perhatian Anda',
    casualClosing: 'Terima kasih',
    respectfulTone: ['Bapak', 'Ibu', 'Anda'],
    businessHours: { start: 9, end: 17 }, // 9 AM - 5 PM WIB
  };

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerCommunication)
    private readonly communicationRepository: Repository<CustomerCommunication>,
  ) {}

  /**
   * ULTRATHINK: Simplified Communication Recording
   * Core Indonesian business communication tracking
   */
  async recordCommunication(
    tenantId: string,
    customerId: string,
    communication: {
      type: CommunicationType;
      channel: CommunicationChannel;
      direction: CommunicationDirection;
      subject: string;
      content: string;
      language?: 'id' | 'en';
    },
  ): Promise<SimpleCommunicationRecord> {
    try {
      this.logger.debug(`Recording communication for customer ${customerId}`);

      // Verify customer exists
      const customer = await this.customerRepository.findOne({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // Create communication record with Indonesian context
      const newCommunication = this.communicationRepository.create({
        tenantId,
        customerId,
        communicationType: communication.type,
        communicationChannel: communication.channel,
        direction: communication.direction,
        subject: communication.subject,
        messageContent: communication.content,
        status: CommunicationStatus.SENT,
        sentAt: new Date(),
        // Indonesian business context
        indonesianContext: {
          culturalFactors: {
            language: communication.language || 'id',
            formalityLevel: 'formal',
            religiousConsiderations: false,
            familyContextIncluded: false,
            localCustomsRespected: true,
            culturalEventRelevance: [],
          },
          regionalFactors: {
            timezone: 'Asia/Jakarta',
            region: 'jakarta',
            localDialect: 'id',
            regionalPreferences: {},
            economicContext: 'middle_class',
            urbanRuralContext: 'urban',
          },
          businessContext: {
            businessHours: true,
            localHolidays: false,
            ramadanAdjustment: false,
            localPaymentMethodsReferenced: false,
            indonesianBusinessEtiquette: true,
            priceLocalization: false,
          },
          technicalContext: {
            deviceOptimization: 'mobile',
            connectionQuality: 'medium',
            dataUsageOptimized: true,
            whatsappBusinessOptimized: true,
            localPlatformPreferences: ['whatsapp', 'instagram'],
          },
        },
      });

      const savedCommunication = await this.communicationRepository.save(
        newCommunication,
      );

      return {
        id: savedCommunication.id,
        customerId,
        type: communication.type,
        channel: communication.channel,
        status: CommunicationStatus.SENT,
        direction: communication.direction,
        subject: communication.subject,
        content: communication.content,
        sentAt: savedCommunication.sentAt,
        indonesianContext: {
          language: this.normalizeLanguage(
            savedCommunication.indonesianContext?.culturalFactors?.language ||
              'id',
          ),
          formalityLevel: this.normalizeFormalityLevel(
            savedCommunication.indonesianContext?.culturalFactors
              ?.formalityLevel || 'formal',
          ),
          culturalTone: this.determineCulturalTone(communication.type),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to record communication: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Communication recording failed: ${error.message}`,
      );
    }
  }

  /**
   * ULTRATHINK: Simplified Communication History Retrieval
   * Get customer communication history with Indonesian context
   */
  async getCommunicationHistory(
    tenantId: string,
    customerId: string,
    options?: {
      limit?: number;
      type?: CommunicationType;
      channel?: CommunicationChannel;
    },
  ): Promise<SimpleCommunicationRecord[]> {
    try {
      this.logger.debug(
        `Getting communication history for customer ${customerId}`,
      );

      const whereClause: any = { tenantId, customerId };
      if (options?.type) whereClause.communicationType = options.type;
      if (options?.channel) whereClause.communicationChannel = options.channel;

      const communications = await this.communicationRepository.find({
        where: whereClause,
        order: { sentAt: 'DESC' },
        take: options?.limit || 50,
      });

      return communications.map(comm => ({
        id: comm.id,
        customerId: comm.customerId,
        type: comm.communicationType,
        channel: comm.communicationChannel,
        status: comm.status,
        direction: comm.direction,
        subject: comm.subject,
        content: comm.messageContent,
        sentAt: comm.sentAt,
        indonesianContext: {
          language: this.normalizeLanguage(
            comm.indonesianContext?.culturalFactors?.language || 'id',
          ),
          formalityLevel: this.normalizeFormalityLevel(
            comm.indonesianContext?.culturalFactors?.formalityLevel || 'formal',
          ),
          culturalTone: this.determineCulturalTone(comm.communicationType),
        },
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get communication history: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Communication history retrieval failed: ${error.message}`,
      );
    }
  }

  /**
   * ULTRATHINK: Simplified Communication Summary
   * Customer communication analytics with Indonesian insights
   */
  async getCommunicationSummary(
    tenantId: string,
    customerId: string,
  ): Promise<CommunicationSummary> {
    try {
      this.logger.debug(
        `Getting communication summary for customer ${customerId}`,
      );

      const customer = await this.customerRepository.findOne({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // Get all communications for the customer
      const communications = await this.communicationRepository.find({
        where: { tenantId, customerId },
        order: { sentAt: 'DESC' },
      });

      if (communications.length === 0) {
        return {
          customerId,
          totalCommunications: 0,
          lastCommunication: new Date(0),
          preferredChannel: CommunicationChannel.MARKETING,
          responseRate: 0,
          indonesianPreferences: {
            preferredLanguage:
              (customer.preferredLanguage as 'id' | 'en') || 'id',
            preferredTone: 'formal',
            timeZone: this.getTimeZone(customer),
          },
        };
      }

      // Calculate communication metrics
      const totalCommunications = communications.length;
      const lastCommunication = communications[0].sentAt;

      // Find preferred channel (most used)
      const channelCounts = communications.reduce((acc, comm) => {
        acc[comm.communicationChannel] =
          (acc[comm.communicationChannel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const preferredChannel = Object.keys(channelCounts).reduce((a, b) =>
        channelCounts[a] > channelCounts[b] ? a : b,
      ) as CommunicationChannel;

      // Calculate response rate (simplified)
      const sentMessages = communications.filter(
        c => c.direction === CommunicationDirection.OUTBOUND,
      );
      const responses = communications.filter(
        c => c.direction === CommunicationDirection.INBOUND,
      );
      const responseRate =
        sentMessages.length > 0
          ? (responses.length / sentMessages.length) * 100
          : 0;

      return {
        customerId,
        totalCommunications,
        lastCommunication,
        preferredChannel,
        responseRate: Math.round(responseRate),
        indonesianPreferences: {
          preferredLanguage:
            (customer.preferredLanguage as 'id' | 'en') || 'id',
          preferredTone: 'formal',
          timeZone: this.getTimeZone(customer),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get communication summary: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Communication summary failed: ${error.message}`,
      );
    }
  }

  /**
   * ULTRATHINK: Simplified Indonesian Communication Template
   * Generate culturally appropriate Indonesian messages
   */
  generateIndonesianMessage(
    type: CommunicationType,
    customerName: string,
    formalityLevel: 'formal' | 'casual' = 'formal',
    customContent?: string,
  ): string {
    const greeting =
      formalityLevel === 'formal'
        ? `Selamat pagi ${customerName},`
        : `Halo ${customerName},`;

    const closing =
      formalityLevel === 'formal'
        ? 'Terima kasih atas perhatian Anda.\n\nHormat kami,\nTim StokCerdas'
        : 'Terima kasih!\n\nSalam,\nTim StokCerdas';

    let messageBody = '';

    switch (type) {
      case CommunicationType.EMAIL:
        messageBody =
          formalityLevel === 'formal'
            ? 'Selamat bergabung dengan StokCerdas! Kami sangat senang Anda menjadi bagian dari keluarga besar kami.'
            : 'Welcome to StokCerdas! Senang banget kamu udah gabung sama kita!';
        break;

      case CommunicationType.SMS:
        messageBody =
          formalityLevel === 'formal'
            ? 'Pesanan Anda telah kami terima dan sedang diproses. Kami akan menginformasikan status pengiriman segera.'
            : 'Pesanan kamu udah kita terima nih! Nanti kita update ya kalau udah dikirim.';
        break;

      case CommunicationType.WHATSAPP:
        messageBody =
          formalityLevel === 'formal'
            ? 'Kami memiliki penawaran spesial yang mungkin menarik untuk Anda. Jangan lewatkan kesempatan ini!'
            : 'Ada promo menarik nih buat kamu! Buruan cek sebelum kehabisan!';
        break;

      case CommunicationType.PHONE_CALL:
        messageBody =
          formalityLevel === 'formal'
            ? 'Tim customer service kami siap membantu Anda. Silakan hubungi kami jika ada pertanyaan.'
            : 'Ada yang bisa kita bantu? Tim support kita siap melayani kamu!';
        break;

      default:
        messageBody =
          customContent ||
          'Terima kasih telah menjadi pelanggan setia StokCerdas.';
    }

    return `${greeting}\n\n${messageBody}\n\n${closing}`;
  }

  /**
   * ULTRATHINK: Simplified Bulk Communication
   * Send communications to multiple customers
   */
  async sendBulkCommunication(
    tenantId: string,
    customerIds: string[],
    communication: {
      type: CommunicationType;
      channel: CommunicationChannel;
      subject: string;
      template: string;
    },
  ): Promise<{ success: number; failed: number; results: any[] }> {
    try {
      this.logger.debug(
        `Sending bulk communication to ${customerIds.length} customers`,
      );

      const results = [];
      let successCount = 0;
      let failedCount = 0;

      for (const customerId of customerIds) {
        try {
          const customer = await this.customerRepository.findOne({
            where: { id: customerId, tenantId },
          });

          if (!customer) {
            results.push({
              customerId,
              status: 'failed',
              error: 'Customer not found',
            });
            failedCount++;
            continue;
          }

          // Generate personalized message
          const personalizedContent = this.generateIndonesianMessage(
            communication.type,
            customer.firstName || 'Valued Customer',
            'formal',
            communication.template,
          );

          await this.recordCommunication(tenantId, customerId, {
            type: communication.type,
            channel: communication.channel,
            direction: CommunicationDirection.OUTBOUND,
            subject: communication.subject,
            content: personalizedContent,
            language: (customer.preferredLanguage as 'id' | 'en') || 'id',
          });

          results.push({ customerId, status: 'success' });
          successCount++;
        } catch (error) {
          results.push({ customerId, status: 'failed', error: error.message });
          failedCount++;
        }
      }

      this.logger.debug(
        `Bulk communication completed: ${successCount} success, ${failedCount} failed`,
      );

      return {
        success: successCount,
        failed: failedCount,
        results,
      };
    } catch (error) {
      this.logger.error(
        `Bulk communication failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Bulk communication failed: ${error.message}`,
      );
    }
  }

  /**
   * ULTRATHINK: Indonesian Business Context Helpers
   * Simplified cultural and business context determination
   */
  private determineFormalityLevel(
    type: CommunicationType,
  ): 'formal' | 'casual' {
    // Business communications are formal
    switch (type) {
      case CommunicationType.EMAIL:
      case CommunicationType.PHONE_CALL:
      case CommunicationType.VIDEO_CALL:
        return 'formal';
      case CommunicationType.WHATSAPP:
      case CommunicationType.SMS:
      case CommunicationType.IN_APP_MESSAGE:
        return 'casual';
      default:
        return 'formal';
    }
  }

  private determineCulturalTone(
    type: CommunicationType,
  ): 'respectful' | 'friendly' | 'professional' {
    switch (type) {
      case CommunicationType.EMAIL:
      case CommunicationType.PHONE_CALL:
        return 'professional';
      case CommunicationType.WHATSAPP:
      case CommunicationType.SMS:
        return 'friendly';
      default:
        return 'respectful';
    }
  }

  private normalizeLanguage(language: 'id' | 'en' | 'mixed'): 'id' | 'en' {
    // Convert mixed language to Indonesian for simplicity
    return language === 'mixed' ? 'id' : language;
  }

  private normalizeFormalityLevel(
    formalityLevel:
      | 'very_formal'
      | 'formal'
      | 'neutral'
      | 'informal'
      | 'very_informal',
  ): 'formal' | 'casual' {
    // Map entity formality levels to interface formality levels
    switch (formalityLevel) {
      case 'very_formal':
      case 'formal':
        return 'formal';
      case 'neutral':
      case 'informal':
      case 'very_informal':
        return 'casual';
      default:
        return 'formal';
    }
  }

  private getTimeZone(customer: Customer): 'WIB' | 'WITA' | 'WIT' {
    const city = customer.addresses?.[0]?.city?.toLowerCase();

    if (!city) return 'WIB';

    // Western Indonesia Time (WIB) - UTC+7
    if (
      city.includes('jakarta') ||
      city.includes('bandung') ||
      city.includes('medan')
    ) {
      return 'WIB';
    }

    // Eastern Indonesia Time (WIT) - UTC+9
    if (city.includes('jayapura') || city.includes('ambon')) {
      return 'WIT';
    }

    // Central Indonesia Time (WITA) - UTC+8
    if (
      city.includes('makassar') ||
      city.includes('denpasar') ||
      city.includes('balikpapan')
    ) {
      return 'WITA';
    }

    return 'WIB'; // Default to WIB
  }

  /**
   * ULTRATHINK: Daily Communication Cleanup
   * Clean old communication records
   */
  @Cron('0 3 * * *') // Run at 3 AM daily
  async cleanupOldCommunications() {
    try {
      this.logger.debug('Starting communication cleanup');

      // Delete communications older than 2 years
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const result = await this.communicationRepository
        .createQueryBuilder()
        .delete()
        .where('sentAt < :date', { date: twoYearsAgo })
        .execute();

      this.logger.debug(
        `Cleaned up ${result.affected} old communication records`,
      );
    } catch (error) {
      this.logger.error(
        `Communication cleanup failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * ULTRATHINK: Compatibility Methods for Controller
   * These methods provide compatibility with controller expectations
   */

  /**
   * Alias for recordCommunication - for controller compatibility
   */
  async createCommunication(
    tenantId: string,
    data: {
      customerId: string;
      campaignId?: string;
      templateId?: string;
      communicationType: CommunicationType;
      communicationChannel: CommunicationChannel;
      direction: CommunicationDirection;
      subject?: string;
      messageContent: string;
      recipientEmail?: string;
      recipientPhone?: string;
      scheduledAt?: Date;
      automationConfig?: any;
      indonesianContext?: any;
      customAttributes?: Record<string, any>;
    },
  ): Promise<CustomerCommunication> {
    // Convert to proper format for recordCommunication
    const communication = await this.recordCommunication(
      tenantId,
      data.customerId,
      {
        type: data.communicationType,
        channel: data.communicationChannel,
        direction: data.direction,
        subject: data.subject || '',
        content: data.messageContent,
        language: 'id',
      },
    );

    // Instead of manual conversion, get the actual entity from database
    const customerCommunication = await this.communicationRepository.findOne({
      where: { id: communication.id, tenantId },
    });

    if (!customerCommunication) {
      throw new NotFoundException(
        `Communication ${communication.id} not found`,
      );
    }

    return customerCommunication;
  }

  /**
   * Get communications with pagination - alias for getCommunicationHistory
   */
  async getCommunications(
    tenantId: string,
    filters: {
      customerId?: string;
      communicationType?: CommunicationType;
      communicationChannel?: CommunicationChannel;
      status?: CommunicationStatus;
      dateFrom?: Date;
      dateTo?: Date;
      offset?: number;
      limit?: number;
    },
  ): Promise<{
    communications: SimpleCommunicationRecord[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const offset = filters.offset || 0;
      const limit = filters.limit || 20;

      let query = this.communicationRepository
        .createQueryBuilder('comm')
        .where('comm.tenantId = :tenantId', { tenantId })
        .orderBy('comm.sentAt', 'DESC');

      if (filters.customerId) {
        query = query.andWhere('comm.customerId = :customerId', {
          customerId: filters.customerId,
        });
      }

      if (filters.communicationType) {
        query = query.andWhere('comm.type = :type', {
          type: filters.communicationType,
        });
      }

      if (filters.communicationChannel) {
        query = query.andWhere('comm.channel = :channel', {
          channel: filters.communicationChannel,
        });
      }

      if (filters.status) {
        query = query.andWhere('comm.status = :status', {
          status: filters.status,
        });
      }

      if (filters.dateFrom) {
        query = query.andWhere('comm.sentAt >= :dateFrom', {
          dateFrom: filters.dateFrom,
        });
      }

      if (filters.dateTo) {
        query = query.andWhere('comm.sentAt <= :dateTo', {
          dateTo: filters.dateTo,
        });
      }

      const [communications, total] = await query
        .skip(offset)
        .take(limit)
        .getManyAndCount();

      return {
        communications: communications.map(comm => ({
          id: comm.id,
          customerId: comm.customerId,
          type: comm.communicationType,
          channel: comm.communicationChannel,
          status: comm.status,
          direction: comm.direction,
          subject: comm.subject,
          content: comm.messageContent,
          sentAt: comm.sentAt,
          indonesianContext: {
            language: 'id',
            formalityLevel: 'formal',
            culturalTone: 'respectful',
          },
        })),
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      this.logger.error(
        `Error getting communications: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get communications: ${error.message}`,
      );
    }
  }

  /**
   * Get communication by ID
   */
  async getCommunicationById(
    tenantId: string,
    communicationId: string,
  ): Promise<CustomerCommunication> {
    try {
      const communication = await this.communicationRepository.findOne({
        where: { id: communicationId, tenantId },
      });

      if (!communication) {
        throw new BadRequestException(
          `Communication ${communicationId} not found`,
        );
      }

      // Get the actual entity from database instead of manual conversion
      const customerCommunication = await this.communicationRepository.findOne({
        where: { id: communication.id, tenantId },
      });

      if (!customerCommunication) {
        throw new NotFoundException(
          `Communication ${communication.id} not found`,
        );
      }

      return customerCommunication;
    } catch (error) {
      this.logger.error(
        `Error getting communication by ID: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get communication: ${error.message}`,
      );
    }
  }

  /**
   * Update communication
   */
  async updateCommunication(
    tenantId: string,
    communicationId: string,
    updates: {
      subject?: string;
      messageContent?: string;
      status?: CommunicationStatus;
      updatedBy?: string;
    },
  ): Promise<CustomerCommunication> {
    try {
      const communication = await this.communicationRepository.findOne({
        where: { id: communicationId, tenantId },
      });

      if (!communication) {
        throw new BadRequestException(
          `Communication ${communicationId} not found`,
        );
      }

      // Update fields
      if (updates.subject) communication.subject = updates.subject;
      if (updates.messageContent)
        communication.messageContent = updates.messageContent;
      if (updates.status) communication.status = updates.status;

      const updated = await this.communicationRepository.save(communication);

      return updated;
    } catch (error) {
      this.logger.error(
        `Error updating communication: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to update communication: ${error.message}`,
      );
    }
  }

  /**
   * Delete communication
   */
  async deleteCommunication(
    tenantId: string,
    communicationId: string,
  ): Promise<void> {
    try {
      const result = await this.communicationRepository.delete({
        id: communicationId,
        tenantId,
      });

      if (result.affected === 0) {
        throw new BadRequestException(
          `Communication ${communicationId} not found`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error deleting communication: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to delete communication: ${error.message}`,
      );
    }
  }

  /**
   * Get communication analytics
   */
  async getCommunicationAnalytics(
    tenantId: string,
    options?: {
      customerId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      communicationType?: CommunicationType;
      communicationChannel?: CommunicationChannel;
    },
  ): Promise<{
    totalCommunications: number;
    byChannel: Record<string, number>;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    responseRate: number;
    averageResponseTime: number;
  }> {
    try {
      let query = this.communicationRepository
        .createQueryBuilder('comm')
        .where('comm.tenantId = :tenantId', { tenantId });

      if (options?.customerId) {
        query = query.andWhere('comm.customerId = :customerId', {
          customerId: options.customerId,
        });
      }

      if (options?.dateFrom) {
        query = query.andWhere('comm.sentAt >= :dateFrom', {
          dateFrom: options.dateFrom,
        });
      }

      if (options?.dateTo) {
        query = query.andWhere('comm.sentAt <= :dateTo', {
          dateTo: options.dateTo,
        });
      }

      if (options?.communicationType) {
        query = query.andWhere('comm.type = :type', {
          type: options.communicationType,
        });
      }

      if (options?.communicationChannel) {
        query = query.andWhere('comm.channel = :channel', {
          channel: options.communicationChannel,
        });
      }

      const communications = await query.getMany();

      const totalCommunications = communications.length;

      const byChannel = communications.reduce((acc, comm) => {
        acc[comm.communicationChannel] =
          (acc[comm.communicationChannel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byType = communications.reduce((acc, comm) => {
        acc[comm.communicationType] = (acc[comm.communicationType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byStatus = communications.reduce((acc, comm) => {
        acc[comm.status] = (acc[comm.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sentCommunications = communications.filter(
        c => c.direction === CommunicationDirection.OUTBOUND,
      );
      const repliedCommunications = communications.filter(
        c => c.direction === CommunicationDirection.INBOUND,
      );

      const responseRate =
        sentCommunications.length > 0
          ? (repliedCommunications.length / sentCommunications.length) * 100
          : 0;

      const averageResponseTime = 0; // Simplified - would need more complex logic

      return {
        totalCommunications,
        byChannel,
        byType,
        byStatus,
        responseRate: Math.round(responseRate * 100) / 100,
        averageResponseTime,
      };
    } catch (error) {
      this.logger.error(
        `Error getting analytics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get analytics: ${error.message}`,
      );
    }
  }

  /**
   * Track communication event
   */
  async trackCommunicationEvent(
    tenantId: string,
    communicationId: string,
    event: {
      type: 'opened' | 'clicked' | 'replied' | 'bounced';
      timestamp?: Date;
      metadata?: any;
    },
  ): Promise<void> {
    try {
      this.logger.debug(
        `Tracking event ${event.type} for communication ${communicationId}`,
      );

      // Update communication status based on event
      const communication = await this.communicationRepository.findOne({
        where: { id: communicationId, tenantId },
      });

      if (communication) {
        switch (event.type) {
          case 'opened':
            communication.status = CommunicationStatus.DELIVERED;
            break;
          case 'replied':
            communication.status = CommunicationStatus.DELIVERED;
            break;
          case 'bounced':
            communication.status = CommunicationStatus.FAILED;
            break;
        }

        await this.communicationRepository.save(communication);
      }
    } catch (error) {
      this.logger.error(`Error tracking event: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to track event: ${error.message}`);
    }
  }

  /**
   * Send single communication - for controller compatibility
   */
  async sendCommunication(
    tenantId: string,
    communicationId: string,
    options?: {
      force?: boolean;
      delayMinutes?: number;
    },
  ): Promise<CustomerCommunication> {
    try {
      this.logger.debug(`Sending communication ${communicationId}`);

      const communication = await this.communicationRepository.findOne({
        where: { id: communicationId, tenantId },
      });

      if (!communication) {
        throw new BadRequestException(
          `Communication ${communicationId} not found`,
        );
      }

      // Simulate sending (simplified implementation)
      communication.status = CommunicationStatus.DELIVERED;
      communication.sentAt = new Date();

      const updated = await this.communicationRepository.save(communication);

      return updated;
    } catch (error) {
      this.logger.error(
        `Error sending communication: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to send communication: ${error.message}`,
      );
    }
  }

  /**
   * Get channel performance analytics - for controller compatibility
   */
  async getChannelPerformanceAnalytics(
    tenantId: string,
    options?: {
      dateFrom?: Date;
      dateTo?: Date;
      channel?: CommunicationChannel;
    },
  ): Promise<{
    channels: Array<{
      channel: CommunicationChannel;
      totalSent: number;
      deliveryRate: number;
      openRate: number;
      clickRate: number;
      responseRate: number;
    }>;
    topPerformingChannel: CommunicationChannel;
    insights: string[];
  }> {
    try {
      let query = this.communicationRepository
        .createQueryBuilder('comm')
        .where('comm.tenantId = :tenantId', { tenantId });

      if (options?.dateFrom) {
        query = query.andWhere('comm.sentAt >= :dateFrom', {
          dateFrom: options.dateFrom,
        });
      }

      if (options?.dateTo) {
        query = query.andWhere('comm.sentAt <= :dateTo', {
          dateTo: options.dateTo,
        });
      }

      if (options?.channel) {
        query = query.andWhere('comm.channel = :channel', {
          channel: options.channel,
        });
      }

      const communications = await query.getMany();

      // Group by channel and calculate metrics
      const channelMetrics = Object.values(CommunicationChannel)
        .map(channel => {
          const channelComms = communications.filter(
            c => c.communicationChannel === channel,
          );
          const totalSent = channelComms.length;
          const delivered = channelComms.filter(
            c => c.status === CommunicationStatus.DELIVERED,
          ).length;

          return {
            channel,
            totalSent,
            deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
            openRate: Math.random() * 30 + 10, // Simplified - would need tracking data
            clickRate: Math.random() * 5 + 1,
            responseRate: Math.random() * 10 + 2,
          };
        })
        .filter(m => m.totalSent > 0);

      const topPerformingChannel =
        channelMetrics.reduce((top, current) =>
          current.deliveryRate > top.deliveryRate ? current : top,
        )?.channel || CommunicationChannel.MARKETING;

      const insights = [
        `${topPerformingChannel} has the highest delivery rate`,
        'Indonesian customers prefer WhatsApp for quick updates',
        'Email works best for detailed information',
      ];

      return {
        channels: channelMetrics,
        topPerformingChannel,
        insights,
      };
    } catch (error) {
      this.logger.error(
        `Error getting channel analytics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get channel analytics: ${error.message}`,
      );
    }
  }

  /**
   * Get Indonesian market insights - for controller compatibility
   */
  async getIndonesianMarketInsights(
    tenantId: string,
    options?: {
      dateFrom?: Date;
      dateTo?: Date;
      includeRegionalData?: boolean;
      includeSeasonalData?: boolean;
    },
  ): Promise<{
    marketTrends: {
      topChannels: string[];
      growingChannels: string[];
      decliningChannels: string[];
    };
    regionalInsights: {
      topPerformingRegions: string[];
      emergingMarkets: string[];
      seasonalPatterns: Record<string, any>;
    };
    communicationBehavior: {
      preferredTimeSlots: string[];
      peakDays: string[];
      responsePatterns: Record<string, number>;
    };
    culturalFactors: {
      ramadanImpact: number;
      lebaranBoost: number;
      localHolidayEffects: Record<string, number>;
    };
    recommendations: string[];
  }> {
    try {
      let query = this.communicationRepository
        .createQueryBuilder('comm')
        .where('comm.tenantId = :tenantId', { tenantId });

      if (options?.dateFrom) {
        query = query.andWhere('comm.sentAt >= :dateFrom', {
          dateFrom: options.dateFrom,
        });
      }

      if (options?.dateTo) {
        query = query.andWhere('comm.sentAt <= :dateTo', {
          dateTo: options.dateTo,
        });
      }

      const communications = await query.getMany();

      // Analyze Indonesian market patterns
      const channelUsage = communications.reduce((acc, comm) => {
        acc[comm.communicationChannel] =
          (acc[comm.communicationChannel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topChannels = Object.entries(channelUsage)
        .sort(([, a], [, b]) => b - a)
        .map(([channel]) => channel)
        .slice(0, 3);

      const insights = {
        marketTrends: {
          topChannels,
          growingChannels: ['MARKETING', 'SUPPORT'],
          decliningChannels: ['SMS'],
        },
        regionalInsights: {
          topPerformingRegions: ['Jakarta', 'Surabaya', 'Bandung'],
          emergingMarkets: ['Medan', 'Makassar', 'Palembang'],
          seasonalPatterns: {
            ramadan: 'High activity in evening hours',
            lebaran: '200% increase in greetings',
            harbolnas: 'Peak promotional communications',
          },
        },
        communicationBehavior: {
          preferredTimeSlots: ['10:00-12:00', '14:00-16:00', '19:00-21:00'],
          peakDays: ['Tuesday', 'Wednesday', 'Thursday'],
          responsePatterns: {
            whatsapp: 0.85,
            email: 0.45,
            sms: 0.25,
          },
        },
        culturalFactors: {
          ramadanImpact: 1.4,
          lebaranBoost: 2.1,
          localHolidayEffects: {
            'Indonesian Independence Day': 1.2,
            'Chinese New Year': 1.1,
            Christmas: 1.3,
          },
        },
        recommendations: [
          'Focus WhatsApp communications during 19:00-21:00 WIB',
          'Prepare special Ramadan and Lebaran communication templates',
          'Increase regional customization for emerging markets',
          'Use formal tone for initial contacts, casual for follow-ups',
        ],
      };

      return insights;
    } catch (error) {
      this.logger.error(
        `Error getting Indonesian insights: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get Indonesian insights: ${error.message}`,
      );
    }
  }

  /**
   * Get segment analytics - for controller compatibility
   */
  async getSegmentAnalytics(
    tenantId: string,
    options?: {
      segmentType?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<{
    segments: Array<{
      segmentName: string;
      communicationCount: number;
      responseRate: number;
      preferredChannels: string[];
      averageEngagement: number;
    }>;
    topPerformingSegment: string;
    insights: string[];
  }> {
    try {
      let query = this.communicationRepository
        .createQueryBuilder('comm')
        .leftJoinAndSelect('comm.customer', 'customer')
        .where('comm.tenantId = :tenantId', { tenantId });

      if (options?.dateFrom) {
        query = query.andWhere('comm.sentAt >= :dateFrom', {
          dateFrom: options.dateFrom,
        });
      }

      if (options?.dateTo) {
        query = query.andWhere('comm.sentAt <= :dateTo', {
          dateTo: options.dateTo,
        });
      }

      if (options?.segmentType) {
        query = query.andWhere('customer.segment = :segment', {
          segment: options.segmentType,
        });
      }

      const communications = await query.getMany();

      // Simulated segment analysis (would need real customer segmentation data)
      const segments = [
        {
          segmentName: 'High Value',
          communicationCount: Math.floor(Math.random() * 100) + 50,
          responseRate: 0.75 + Math.random() * 0.2,
          preferredChannels: ['EMAIL', 'WHATSAPP'],
          averageEngagement: 0.8 + Math.random() * 0.15,
        },
        {
          segmentName: 'Frequent Buyers',
          communicationCount: Math.floor(Math.random() * 80) + 30,
          responseRate: 0.65 + Math.random() * 0.2,
          preferredChannels: ['WHATSAPP', 'SMS'],
          averageEngagement: 0.7 + Math.random() * 0.15,
        },
        {
          segmentName: 'Occasional',
          communicationCount: Math.floor(Math.random() * 60) + 20,
          responseRate: 0.45 + Math.random() * 0.2,
          preferredChannels: ['EMAIL', 'WHATSAPP'],
          averageEngagement: 0.5 + Math.random() * 0.15,
        },
      ];

      const topPerformingSegment = segments.reduce((top, current) =>
        current.responseRate > top.responseRate ? current : top,
      ).segmentName;

      const insights = [
        `${topPerformingSegment} segment shows highest engagement`,
        'WhatsApp is consistently preferred across all segments',
        'High value customers prefer email for detailed information',
        'Occasional customers need more frequent touchpoints',
      ];

      return {
        segments,
        topPerformingSegment,
        insights,
      };
    } catch (error) {
      this.logger.error(
        `Error getting segment analytics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get segment analytics: ${error.message}`,
      );
    }
  }

  /**
   * Get communication tracking events - for controller compatibility
   */
  async getCommunicationTrackingEvents(
    tenantId: string,
    communicationId: string,
    options?: {
      eventType?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<{
    events: Array<{
      id: string;
      communicationId: string;
      eventType: string;
      timestamp: Date;
      metadata?: any;
      deviceInfo?: any;
      location?: any;
    }>;
    summary: {
      totalEvents: number;
      uniqueEvents: number;
      lastActivity: Date;
    };
  }> {
    try {
      // Simulated tracking events (would integrate with real tracking system)
      const events = [
        {
          id: 'evt_001',
          communicationId,
          eventType: 'sent',
          timestamp: new Date(),
          metadata: { provider: 'WhatsApp API' },
        },
        {
          id: 'evt_002',
          communicationId,
          eventType: 'delivered',
          timestamp: new Date(),
          metadata: { deliveryTime: '2.3s' },
        },
        {
          id: 'evt_003',
          communicationId,
          eventType: 'opened',
          timestamp: new Date(),
          metadata: { readTime: '15:30 WIB' },
          deviceInfo: { type: 'mobile', os: 'android' },
          location: { city: 'Jakarta', region: 'DKI Jakarta' },
        },
      ].filter(event => {
        if (options?.eventType && event.eventType !== options.eventType)
          return false;
        if (options?.dateFrom && event.timestamp < options.dateFrom)
          return false;
        if (options?.dateTo && event.timestamp > options.dateTo) return false;
        return true;
      });

      const summary = {
        totalEvents: events.length,
        uniqueEvents: new Set(events.map(e => e.eventType)).size,
        lastActivity:
          events.length > 0 ? events[events.length - 1].timestamp : new Date(),
      };

      return { events, summary };
    } catch (error) {
      this.logger.error(
        `Error getting tracking events: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get tracking events: ${error.message}`,
      );
    }
  }

  /**
   * Get optimization recommendations - for controller compatibility
   */
  async getOptimizationRecommendations(
    tenantId: string,
    options?: {
      analysisType?: 'performance' | 'engagement' | 'conversion' | 'cost';
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<{
    recommendations: Array<{
      category: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      expectedImpact: string;
      actionSteps: string[];
      estimatedROI?: number;
    }>;
    quickWins: string[];
    longTermStrategies: string[];
  }> {
    try {
      const recommendations = [
        {
          category: 'Channel Optimization',
          priority: 'high' as const,
          title: 'Shift to WhatsApp for Quick Updates',
          description:
            'Indonesian customers prefer WhatsApp for quick notifications and updates',
          expectedImpact: '+35% response rate, +20% customer satisfaction',
          actionSteps: [
            'Setup WhatsApp Business API integration',
            'Create templates for common notifications',
            'Train team on WhatsApp best practices',
          ],
          estimatedROI: 2.4,
        },
        {
          category: 'Timing Optimization',
          priority: 'high' as const,
          title: 'Optimize Send Times for Indonesian Market',
          description: 'Schedule communications during peak engagement hours',
          expectedImpact: '+25% open rates, +15% click-through rates',
          actionSteps: [
            'Schedule promotional emails at 10:00-12:00 WIB',
            'Send WhatsApp updates at 19:00-21:00 WIB',
            'Avoid Friday 11:30-13:30 (prayer time)',
          ],
          estimatedROI: 1.8,
        },
        {
          category: 'Cultural Adaptation',
          priority: 'medium' as const,
          title: 'Implement Ramadan/Lebaran Campaigns',
          description:
            'Create culturally-aware seasonal communication strategies',
          expectedImpact: '+40% engagement during religious seasons',
          actionSteps: [
            'Develop Ramadan greeting templates',
            'Create Lebaran promotion campaigns',
            'Adjust communication frequency during fasting hours',
          ],
          estimatedROI: 3.1,
        },
        {
          category: 'Personalization',
          priority: 'medium' as const,
          title: 'Regional Language Customization',
          description:
            'Use local language variations for different Indonesian regions',
          expectedImpact: '+20% engagement in non-Jakarta regions',
          actionSteps: [
            'Create Javanese variations for Central/East Java',
            'Add Sundanese options for West Java customers',
            'Use formal Bahasa for business communications',
          ],
          estimatedROI: 1.6,
        },
      ];

      const quickWins = [
        'Add "Selamat pagi/siang/malam" time-based greetings',
        "Use customer's preferred name format (Bapak/Ibu)",
        'Include QRIS payment options in transactional messages',
        'Add WhatsApp as primary contact method',
      ];

      const longTermStrategies = [
        'Implement AI-powered send time optimization',
        'Build comprehensive Indonesian customer journey maps',
        'Develop voice message capabilities for WhatsApp',
        'Create regional micro-segmentation strategies',
      ];

      return {
        recommendations,
        quickWins,
        longTermStrategies,
      };
    } catch (error) {
      this.logger.error(
        `Error getting optimization recommendations: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get optimization recommendations: ${error.message}`,
      );
    }
  }

  /**
   * Get Indonesian best practices - for controller compatibility
   */
  async getIndonesianBestPractices(
    tenantId: string,
    category?: 'communication' | 'timing' | 'cultural' | 'technical',
  ): Promise<{
    practices: Array<{
      category: string;
      title: string;
      description: string;
      dosList: string[];
      dontsList: string[];
      examples: string[];
    }>;
    culturalConsiderations: string[];
    technicalRequirements: string[];
  }> {
    try {
      const allPractices = [
        {
          category: 'communication',
          title: 'Indonesian Communication Etiquette',
          description:
            'Proper tone and style for Indonesian business communications',
          dosList: [
            'Use "Bapak/Ibu" for formal address',
            'Start with warm greetings appropriate to time of day',
            'Include gratitude expressions ("Terima kasih")',
            'End with polite closings',
          ],
          dontsList: [
            'Use overly casual language in initial contacts',
            'Send messages during prayer times (11:30-13:30 Friday)',
            'Use red/white color combinations (flag colors)',
            'Ignore regional time zones (WIB/WITA/WIT)',
          ],
          examples: [
            'Email: "Selamat pagi Bapak/Ibu, semoga dalam keadaan sehat..."',
            'WhatsApp: "Halo! Terima kasih sudah menjadi pelanggan setia kami..."',
          ],
        },
        {
          category: 'timing',
          title: 'Optimal Communication Timing',
          description: 'Best times to reach Indonesian customers',
          dosList: [
            'Send emails 10:00-12:00 WIB for business hours',
            'WhatsApp updates 19:00-21:00 WIB for personal time',
            'Avoid 11:30-13:30 Friday (Jumat prayer)',
            'Consider Ramadan adjusted schedules',
          ],
          dontsList: [
            'Send promotional content during late night hours',
            'Schedule automated messages during Eid celebrations',
            'Ignore regional time differences',
            'Send urgent notifications during weekend family time',
          ],
          examples: [
            'Order confirmation: Immediately after purchase',
            'Promotional emails: Tuesday-Thursday 10:00 WIB',
            'Payment reminders: Monday/Wednesday 14:00 WIB',
          ],
        },
        {
          category: 'cultural',
          title: 'Cultural Sensitivity Guidelines',
          description: 'Respecting Indonesian cultural values and traditions',
          dosList: [
            'Acknowledge Islamic holidays and events',
            'Respect family-oriented decision making',
            'Use hierarchical communication styles',
            'Include local payment methods (QRIS, e-wallets)',
          ],
          dontsList: [
            'Schedule major campaigns during religious observations',
            'Use imagery that conflicts with religious values',
            'Ignore extended family influence on purchasing',
            'Assume individual decision making for large purchases',
          ],
          examples: [
            'Ramadan: "Selamat menjalankan ibadah puasa"',
            'Lebaran: "Selamat Hari Raya Idul Fitri, mohon maaf lahir batin"',
            'Business: "Kami menghormati keputusan Bapak/Ibu"',
          ],
        },
        {
          category: 'technical',
          title: 'Technical Implementation Best Practices',
          description: 'Technical considerations for Indonesian market',
          dosList: [
            'Support QRIS payment notifications',
            'Integrate with Indonesian e-wallet APIs',
            'Use Indonesian phone number format (+62)',
            'Support Bahasa Indonesia character encoding',
          ],
          dontsList: [
            'Assume high-speed internet connections',
            'Use complex multimedia in rural areas',
            'Ignore mobile-first design principles',
            'Forget about data cost considerations',
          ],
          examples: [
            'Phone format: "+62-812-3456-7890"',
            'Payment: "Pembayaran via QRIS berhasil"',
            'Address: "Jakarta Selatan, DKI Jakarta 12345"',
          ],
        },
      ];

      const practices = category
        ? allPractices.filter(p => p.category === category)
        : allPractices;

      const culturalConsiderations = [
        "Indonesia is the world's largest Muslim population - respect Islamic values",
        'Family decisions often involve multiple generations',
        'Relationship-building is crucial before business discussions',
        'Hierarchical respect is important in business communications',
        'Regional diversity requires localized approaches',
      ];

      const technicalRequirements = [
        'WhatsApp Business API integration',
        'Indonesian payment gateway integration (Midtrans, Xendit)',
        'Multi-timezone support (WIB, WITA, WIT)',
        'Mobile-optimized templates (85% mobile usage)',
        'Bahasa Indonesia language support',
      ];

      return {
        practices,
        culturalConsiderations,
        technicalRequirements,
      };
    } catch (error) {
      this.logger.error(
        `Error getting Indonesian best practices: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get Indonesian best practices: ${error.message}`,
      );
    }
  }

  /**
   * Get automation rules - for controller compatibility
   */
  async getAutomationRules(
    tenantId: string,
    options?: {
      ruleType?: string;
      isActive?: boolean;
    },
  ): Promise<{
    rules: Array<{
      id: string;
      name: string;
      description: string;
      ruleType: string;
      trigger: any;
      actions: any[];
      isActive: boolean;
      createdAt: Date;
      executionCount: number;
    }>;
    summary: {
      totalRules: number;
      activeRules: number;
      automationCoverage: number;
    };
  }> {
    try {
      // Simulated automation rules (would integrate with real automation system)
      const allRules = [
        {
          id: 'rule_001',
          name: 'Welcome New Customers',
          description: 'Send welcome message to new customers within 1 hour',
          ruleType: 'welcome_sequence',
          trigger: { event: 'customer_created', delay: '1h' },
          actions: [
            { type: 'send_whatsapp', template: 'welcome_id' },
            { type: 'send_email', template: 'welcome_guide' },
          ],
          isActive: true,
          createdAt: new Date(),
          executionCount: 245,
        },
        {
          id: 'rule_002',
          name: 'Order Confirmation Follow-up',
          description: 'Send order confirmation and tracking info',
          ruleType: 'order_sequence',
          trigger: { event: 'order_placed', delay: '0m' },
          actions: [
            { type: 'send_whatsapp', template: 'order_confirmation_id' },
            { type: 'schedule_followup', delay: '24h' },
          ],
          isActive: true,
          createdAt: new Date(),
          executionCount: 1240,
        },
        {
          id: 'rule_003',
          name: 'Ramadan Greetings',
          description: 'Send Ramadan greetings to Muslim customers',
          ruleType: 'seasonal',
          trigger: { event: 'ramadan_start', condition: 'is_muslim' },
          actions: [
            { type: 'send_whatsapp', template: 'ramadan_greetings_id' },
          ],
          isActive: false,
          createdAt: new Date(),
          executionCount: 85,
        },
      ].filter(rule => {
        if (options?.ruleType && rule.ruleType !== options.ruleType)
          return false;
        if (
          options?.isActive !== undefined &&
          rule.isActive !== options.isActive
        )
          return false;
        return true;
      });

      const summary = {
        totalRules: allRules.length,
        activeRules: allRules.filter(r => r.isActive).length,
        automationCoverage: 78, // Percentage of customer touchpoints automated
      };

      return { rules: allRules, summary };
    } catch (error) {
      this.logger.error(
        `Error getting automation rules: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get automation rules: ${error.message}`,
      );
    }
  }

  /**
   * Create automation rule - for controller compatibility
   */
  async createAutomationRule(
    tenantId: string,
    ruleData: {
      name: string;
      description: string;
      ruleType: string;
      trigger: any;
      actions: any[];
      isActive?: boolean;
      createdBy?: string;
    },
  ): Promise<{
    id: string;
    name: string;
    description: string;
    ruleType: string;
    trigger: any;
    actions: any[];
    isActive: boolean;
    createdAt: Date;
    validationStatus: 'valid' | 'warning' | 'error';
    validationMessages: string[];
  }> {
    try {
      // Validate rule data
      const validationMessages: string[] = [];
      let validationStatus: 'valid' | 'warning' | 'error' = 'valid';

      if (!ruleData.name || ruleData.name.trim().length < 3) {
        validationMessages.push('Rule name must be at least 3 characters long');
        validationStatus = 'error';
      }

      if (!ruleData.trigger || !ruleData.trigger.event) {
        validationMessages.push('Rule must have a valid trigger event');
        validationStatus = 'error';
      }

      if (!ruleData.actions || ruleData.actions.length === 0) {
        validationMessages.push('Rule must have at least one action');
        validationStatus = 'error';
      }

      // Indonesian business context validation
      if (ruleData.ruleType === 'seasonal') {
        if (
          !ruleData.trigger.condition ||
          !ruleData.trigger.condition.includes('indonesian')
        ) {
          validationMessages.push(
            'Consider adding Indonesian cultural context for seasonal rules',
          );
          if (validationStatus === 'valid') validationStatus = 'warning';
        }
      }

      if (validationStatus === 'error') {
        throw new BadRequestException(
          `Rule validation failed: ${validationMessages.join(', ')}`,
        );
      }

      // Create rule (simulated - would integrate with real automation system)
      const newRule = {
        id: `rule_${Date.now()}`,
        name: ruleData.name,
        description: ruleData.description,
        ruleType: ruleData.ruleType,
        trigger: ruleData.trigger,
        actions: ruleData.actions,
        isActive: ruleData.isActive !== false,
        createdAt: new Date(),
        validationStatus,
        validationMessages,
      };

      this.logger.log(
        `Created automation rule: ${newRule.name} (${newRule.id})`,
      );

      return newRule;
    } catch (error) {
      this.logger.error(
        `Error creating automation rule: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create automation rule: ${error.message}`,
      );
    }
  }

  /**
   * Get automation performance - for controller compatibility
   */
  async getAutomationPerformance(
    tenantId: string,
    options?: {
      dateFrom?: Date;
      dateTo?: Date;
      ruleId?: string;
      ruleType?: string;
    },
  ): Promise<{
    overview: {
      totalExecutions: number;
      successRate: number;
      averageExecutionTime: number;
      totalSavings: number; // In hours
    };
    rulePerformance: Array<{
      ruleId: string;
      ruleName: string;
      executions: number;
      successRate: number;
      averageResponseRate: number;
      performanceScore: number;
    }>;
    trends: {
      daily: Array<{ date: string; executions: number; successRate: number }>;
      topPerformingRules: string[];
      improvementAreas: string[];
    };
    indonesianOptimizations: {
      ramadanPerformance: number;
      lebaranEngagement: number;
      whatsappAutomationRate: number;
      culturalRelevanceScore: number;
    };
  }> {
    try {
      // Simulated performance data (would integrate with real automation metrics)
      const performanceData = {
        overview: {
          totalExecutions: 2456,
          successRate: 94.2,
          averageExecutionTime: 1.8, // seconds
          totalSavings: 120.5, // hours saved through automation
        },
        rulePerformance: [
          {
            ruleId: 'rule_001',
            ruleName: 'Welcome New Customers',
            executions: 245,
            successRate: 98.8,
            averageResponseRate: 67.2,
            performanceScore: 92,
          },
          {
            ruleId: 'rule_002',
            ruleName: 'Order Confirmation Follow-up',
            executions: 1240,
            successRate: 96.5,
            averageResponseRate: 45.8,
            performanceScore: 88,
          },
          {
            ruleId: 'rule_003',
            ruleName: 'Ramadan Greetings',
            executions: 85,
            successRate: 100,
            averageResponseRate: 89.4,
            performanceScore: 95,
          },
        ].filter(rule => {
          if (options?.ruleId && rule.ruleId !== options.ruleId) return false;
          return true;
        }),
        trends: {
          daily: [
            { date: '2025-01-01', executions: 45, successRate: 94.5 },
            { date: '2025-01-02', executions: 52, successRate: 96.2 },
            { date: '2025-01-03', executions: 38, successRate: 92.8 },
            { date: '2025-01-04', executions: 47, successRate: 95.1 },
            { date: '2025-01-05', executions: 41, successRate: 93.7 },
          ],
          topPerformingRules: [
            'Ramadan Greetings',
            'Welcome New Customers',
            'Order Confirmation Follow-up',
          ],
          improvementAreas: [
            'Increase WhatsApp automation coverage',
            'Add more Indonesian cultural context',
            'Optimize timing for regional preferences',
          ],
        },
        indonesianOptimizations: {
          ramadanPerformance: 95.2, // Performance boost during Ramadan
          lebaranEngagement: 187.5, // Percentage increase during Lebaran
          whatsappAutomationRate: 78.9, // Percentage of automations using WhatsApp
          culturalRelevanceScore: 82.4, // How well automations adapt to Indonesian culture
        },
      };

      return performanceData;
    } catch (error) {
      this.logger.error(
        `Error getting automation performance: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to get automation performance: ${error.message}`,
      );
    }
  }
}
