import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType, NotificationStatus, NotificationPriority } from '../entities/notification.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationSubscription } from '../entities/notification-subscription.entity';

export interface CreateNotificationDto {
  title: string;
  message: string;
  type: NotificationType;
  userId: string;
  tenantId: string;
  priority?: NotificationPriority;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientDeviceToken?: string;
  data?: Record<string, any>;
  scheduledAt?: Date;
  templateId?: string;
  templateVariables?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
    @InjectRepository(NotificationSubscription)
    private readonly subscriptionRepository: Repository<NotificationSubscription>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...dto,
      status: NotificationStatus.PENDING,
      priority: dto.priority || NotificationPriority.NORMAL,
    });

    return this.notificationRepository.save(notification);
  }

  async findById(id: string, tenantId: string): Promise<Notification> {
    return this.notificationRepository.findOne({
      where: { id, tenantId },
    });
  }

  async findByUser(userId: string, tenantId: string, limit: number = 50): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId, tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async markAsRead(id: string, tenantId: string): Promise<void> {
    await this.notificationRepository.update(
      { id, tenantId },
      { 
        status: NotificationStatus.READ,
        readAt: new Date(),
      }
    );
  }

  async markAsSent(id: string): Promise<void> {
    await this.notificationRepository.update(
      { id },
      { 
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      }
    );
  }

  async markAsDelivered(id: string): Promise<void> {
    await this.notificationRepository.update(
      { id },
      { 
        status: NotificationStatus.DELIVERED,
        deliveredAt: new Date(),
      }
    );
  }

  async markAsFailed(id: string, errorMessage: string): Promise<void> {
    await this.notificationRepository.update(
      { id },
      { 
        status: NotificationStatus.FAILED,
        errorMessage,
      }
    );
  }

  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    return this.notificationRepository.count({
      where: {
        userId,
        tenantId,
        status: NotificationStatus.PENDING,
      },
    });
  }

  // Template methods
  async createTemplate(templateData: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    const template = this.templateRepository.create(templateData);
    return this.templateRepository.save(template);
  }

  async getTemplate(code: string, tenantId: string): Promise<NotificationTemplate> {
    return this.templateRepository.findOne({
      where: { code, tenantId, isActive: true },
    });
  }

  // Subscription methods
  async subscribe(
    userId: string,
    tenantId: string,
    eventType: string,
    notificationType: NotificationType,
  ): Promise<NotificationSubscription> {
    const subscription = this.subscriptionRepository.create({
      userId,
      tenantId,
      eventType,
      notificationType,
      isEnabled: true,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async isSubscribed(
    userId: string,
    tenantId: string,
    eventType: string,
    notificationType: NotificationType,
  ): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        userId,
        tenantId,
        eventType,
        notificationType,
        isEnabled: true,
      },
    });

    return !!subscription;
  }
}