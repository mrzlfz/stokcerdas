import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { NotificationsController } from './controllers/notifications.controller';

// Services
import { NotificationsService } from './services/notifications.service';
import { EmailService } from './services/email.service';
import { EmailTemplateService } from './services/email-template.service';
import { PushNotificationService } from './services/push-notification.service';
import { SmsService } from './services/sms.service';

// Entities
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationSubscription } from './entities/notification-subscription.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      Notification,
      NotificationTemplate,
      NotificationSubscription,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailService,
    EmailTemplateService,
    PushNotificationService,
    SmsService,
  ],
  exports: [
    NotificationsService,
    EmailService,
    EmailTemplateService,
    PushNotificationService,
    SmsService,
  ],
})
export class NotificationsModule {}
